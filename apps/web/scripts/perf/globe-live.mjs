// Checks that the 3D globe really draws on a running production server, with
// the site's own Content-Security-Policy in force.
//
//   node scripts/perf/globe-live.mjs [base-url]
//
// The globe is decoration: when it cannot load, the still poster stays and
// nothing looks broken. That is how a texture decoder the policy forbids kept
// the globe a picture in production for a week while the development server
// (which relaxes the policy) showed it turning. This loads the landing page
// as a capable desktop browser would and waits for the poster to hand over to
// the 3D scene; it fails with whatever errors the page reported if it does not.

import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:3000';
const WAIT_MS = 30_000;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = [];
  page.on('pageerror', (error) => problems.push(`page error: ${String(error).slice(0, 300)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 300)}`);
  });
  page.on('requestfailed', (request) =>
    problems.push(`failed: ${request.url()} (${request.failure()?.errorText})`),
  );

  await page.goto(`${base}/`, { waitUntil: 'load' });
  // The slot holds the poster first; the canvas joins it, and the poster
  // fades out once the scene has drawn its first frame.
  const live = await page
    .waitForFunction(
      () => {
        const canvas = document.querySelector('canvas');
        const poster = canvas?.closest('.aspect-square')?.firstElementChild;
        return Boolean(poster) && getComputedStyle(poster).opacity === '0';
      },
      null,
      { timeout: WAIT_MS },
    )
    .then(() => true)
    .catch(() => false);

  if (!live) {
    const device = await page.evaluate(() => ({
      cores: navigator.hardwareConcurrency,
      memoryGb: navigator.deviceMemory,
      webgl2: typeof WebGL2RenderingContext !== 'undefined',
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      canvas: Boolean(document.querySelector('canvas')),
    }));
    console.error(`The 3D globe did not draw within ${WAIT_MS / 1000} s.`);
    console.error(`Device as the page saw it: ${JSON.stringify(device)}`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exitCode = 1;
  } else {
    console.log('The 3D globe drew under the production security policy.');
  }
} finally {
  await browser.close();
}
