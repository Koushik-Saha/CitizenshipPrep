// The Maestro flow (.maestro/mock-exam.yaml), run against the browser build
// with Playwright: completes a mock exam from the dashboard to the results.
// It exercises the same screens and the same engine, but not the phone: it is
// a stand-in for machines without a simulator, not a replacement.
//
//   pnpm --filter @oathly/mobile web          (with a test session, see README.md)
//   node e2e/mock-exam.web.mjs [http://localhost:8081]

import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:8081';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const problems = [];
page.on('pageerror', (error) => problems.push(String(error)));

const byId = (id) => page.locator(`[data-testid="${id}"]`);
const byPrefix = (prefix) => page.locator(`[data-testid^="${prefix}"]`);

await page.goto(base, { waitUntil: 'load', timeout: 120_000 });

// A brand-new test learner lands on onboarding first.
await Promise.race([
  byId('finish-onboarding').waitFor({ timeout: 120_000 }),
  byPrefix('practise-').first().waitFor({ timeout: 120_000 }),
]);
if (await byId('finish-onboarding').count()) {
  await byPrefix('country-').first().click();
  await byId('finish-onboarding').click();
}

await byPrefix('mock-exam-').first().waitFor({ timeout: 60_000 });
await byPrefix('mock-exam-').first().click();
await byId('audio-mode').waitFor({ timeout: 30_000 });
// A spoken exam opens as a mock interview, with the question's text out of
// sight. This flow answers by tapping, so it switches audio mode off.
if (await byId('show-question').count()) await byId('audio-mode').click();
await byId('question-text').waitFor({ timeout: 30_000 });

let answered = 0;
while ((await byId('results').count()) === 0) {
  await byId('option-0').click();
  await byId('next').click();
  answered += 1;
  if (answered > 200) throw new Error('The exam never ended.');
  await page.waitForTimeout(100);
}
const heading = await page.getByRole('heading').first().innerText();
await byId('back-to-study').click();
await byPrefix('practise-').first().waitFor({ timeout: 30_000 });
await browser.close();

if (problems.length > 0) {
  console.error(`Page errors:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`Mock exam completed: ${answered} questions answered, result "${heading}".`);
