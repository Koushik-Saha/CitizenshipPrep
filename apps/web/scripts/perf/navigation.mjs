// Measures click-to-render for prefetched links against a running production
// server ("prefetched nav < 100ms" in CLAUDE.md).
//
//   node scripts/perf/navigation.mjs [base-url]
//
// For each route: load the page, let the viewport prefetch finish, click the
// link, and time from the click until the new page's heading is on screen
// (the frame after React commits it). Reports the median of several runs.
//
// NAV_BUDGET_MS sets the pass mark (default 100). Shared CI runners are a few
// times slower than a laptop, so CI passes a looser number and relies on the
// second check instead: a prefetched navigation must not wait for the server,
// so no page data may be requested between the click and the render.

import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:3000';
const budget = Number(process.env.NAV_BUDGET_MS ?? 100);
const RUNS = 5;

/** Finds a country and one of its topics from the pages themselves: nothing here names a country. */
async function discover(page) {
  await page.goto(`${base}/countries`, { waitUntil: 'load' });
  const country = await page.locator('main a[href^="/countries/"]').first().getAttribute('href');
  if (!country) throw new Error('No country pages to test: is the database seeded?');
  await page.goto(base + country, { waitUntil: 'load' });
  const topic = await page.locator(`main a[href^="${country}/"]`).first().getAttribute('href');
  if (!topic) throw new Error(`No topic pages under ${country}.`);
  return { country, topic };
}

async function measure(page, { from, link }) {
  await page.goto(base + from, { waitUntil: 'load' });
  const target = page.locator(link).first();
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500); // the link is in view: let its prefetch finish
  const href = await target.getAttribute('href');

  let dataRequests = 0;
  const onRequest = (request) => {
    const url = new URL(request.url());
    // Page data for the destination: its RSC payload or its document.
    if (url.pathname === href && !request.url().includes('_next/static')) dataRequests += 1;
  };
  page.on('request', onRequest);
  await page.evaluate((destination) => {
    window.__navigation = new Promise((resolve) => {
      let clickedAt;
      let before;
      addEventListener(
        'click',
        () => {
          clickedAt = performance.now();
          before = document.querySelector('h1')?.textContent;
        },
        { capture: true, once: true },
      );
      const check = () => {
        const heading = document.querySelector('h1')?.textContent;
        if (clickedAt !== undefined && location.pathname === destination && heading !== before) {
          // One more frame: the browser has painted the new page by then.
          requestAnimationFrame(() => resolve(performance.now() - clickedAt));
          return;
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  }, href);
  await target.click();
  const ms = await page.evaluate(() => window.__navigation);
  page.off('request', onRequest);
  return { ms, dataRequests };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const { country, topic } = await discover(page);
const routes = [
  { name: `/ -> ${country}`, from: '/', link: `a[href="${country}"]` },
  { name: `${country} -> ${topic}`, from: country, link: `a[href="${topic}"]` },
  { name: `${topic} -> /countries`, from: topic, link: 'main a[href="/countries"]' },
  { name: '/ -> /sign-in', from: '/', link: 'header a[href="/sign-in"]' },
  { name: '/countries -> /', from: '/countries', link: 'header a[href="/"]' },
];

let failed = false;
for (const route of routes) {
  const runs = [];
  for (let i = 0; i < RUNS; i += 1) runs.push(await measure(page, route));
  const times = runs.map((run) => run.ms).sort((a, b) => a - b);
  const median = times[Math.floor(RUNS / 2)];
  const waited = runs.some((run) => run.dataRequests > 0);
  const ok = median < budget && !waited;
  failed ||= !ok;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${route.name.padEnd(48)} median ${median.toFixed(0)} ms` +
      `  (${times.map((t) => t.toFixed(0)).join(', ')})` +
      (waited ? '  waited for the server: the route was not prefetched' : ''),
  );
}
await browser.close();
if (failed) {
  console.error(`A prefetched navigation took ${budget} ms or more, or was not prefetched.`);
  process.exit(1);
}
