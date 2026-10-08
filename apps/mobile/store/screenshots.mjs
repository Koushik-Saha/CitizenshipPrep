// Store screenshots for every device size the App Store and Google Play ask
// for, captured from the app's browser build.
//
//   pnpm --filter @oathly/mobile store:screenshots [http://localhost:8081]
//
// The app must be running in a browser under a test session whose learner
// studies a country with published questions (see README.md here). What is on
// screen is whatever that learner sees, so run this against real, published
// content before uploading anything: the stores require screenshots to show
// the app as it is.
//
// These are a browser's rendering of the app, at each device's size and pixel
// density. The layout, colours and content are the app's; the fonts' fine
// detail and the missing status bar are not a phone's.

import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] ?? 'http://localhost:8081';

// Viewport in points and the device's pixel ratio: the file is their product,
// which is the size each store names.
const devices = [
  // App Store: 6.9" is required for iPhone; 13" for iPad if the app runs on iPad.
  { id: 'ios-6.9', store: 'App Store, iPhone 6.9"', width: 440, height: 956, scale: 3 }, // 1320 x 2868
  { id: 'ios-6.5', store: 'App Store, iPhone 6.5"', width: 414, height: 896, scale: 3 }, // 1242 x 2688
  { id: 'ipad-13', store: 'App Store, iPad 13"', width: 1032, height: 1376, scale: 2 }, // 2064 x 2752
  // Google Play: phone, 7" tablet, 10" tablet. 9:16, within Play's limits.
  { id: 'android-phone', store: 'Google Play, phone', width: 360, height: 640, scale: 3 }, // 1080 x 1920
  { id: 'android-7in', store: 'Google Play, 7" tablet', width: 600, height: 960, scale: 2 }, // 1200 x 1920
  { id: 'android-10in', store: 'Google Play, 10" tablet', width: 800, height: 1280, scale: 2 }, // 1600 x 2560
];

const byId = (page, id) => page.locator(`[data-testid="${id}"]`);
const byPrefix = (page, prefix) => page.locator(`[data-testid^="${prefix}"]`);

async function study(page) {
  await page.goto(base, { waitUntil: 'load', timeout: 120_000 });
  await byPrefix(page, 'practise-').first().waitFor({ timeout: 120_000 });
  // Let the readiness arc and any entrance motion settle.
  await page.waitForTimeout(1200);
}

/** A session that reads its questions aloud is switched to the written form. */
async function writtenForm(page) {
  await byId(page, 'audio-mode').waitFor({ timeout: 30_000 });
  if (await byId(page, 'show-question').count()) await byId(page, 'audio-mode').click();
  await byId(page, 'question-text').waitFor({ timeout: 30_000 });
}

// The screens, in the order they should appear in a listing. Each starts
// where the one before left off unless it opens the Study tab itself.
const shots = [
  { name: '01-study', go: async (page) => study(page) },
  {
    name: '02-question',
    go: async (page) => {
      await study(page);
      await byPrefix(page, 'practise-').first().click();
      await writtenForm(page);
      await byId(page, 'option-0').click();
    },
  },
  {
    name: '03-explained',
    go: async (page) => {
      await byId(page, 'check').click();
      await byId(page, 'next').waitFor({ timeout: 30_000 });
    },
  },
  {
    name: '04-results',
    go: async (page) => {
      await byId(page, 'next').click();
      for (let i = 0; i < 200 && !(await byId(page, 'results').count()); i += 1) {
        await byId(page, 'option-0').click();
        await byId(page, 'check').click();
        await byId(page, 'next').click();
        await page.waitForTimeout(80);
      }
      await byId(page, 'results').waitFor({ timeout: 30_000 });
      await page.waitForTimeout(1500);
    },
  },
  {
    name: '05-flashcards',
    go: async (page) => {
      await study(page);
      await byPrefix(page, 'flashcards-').first().click();
      await byId(page, 'flashcard').waitFor({ timeout: 30_000 });
      await byId(page, 'show-answer').click();
      await byId(page, 'knew-it').waitFor({ timeout: 30_000 });
    },
  },
  {
    name: '06-plans',
    go: async (page) => {
      await study(page);
      await byId(page, 'tab-profile').click();
      await byId(page, 'open-plans').click();
      await byId(page, 'current-plan').waitFor({ timeout: 30_000 });
    },
  },
];

const out = path.join(here, 'screenshots');
rmSync(out, { recursive: true, force: true });
const browser = await chromium.launch();
for (const device of devices) {
  const folder = path.join(out, device.id);
  mkdirSync(folder, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.scale,
    isMobile: device.width < 600,
    hasTouch: true,
    colorScheme: 'light',
    locale: 'en-US',
  });
  const page = await context.newPage();
  for (const shot of shots) {
    await shot.go(page);
    await page.screenshot({ path: path.join(folder, `${shot.name}.png`) });
  }
  await context.close();
  console.log(
    `${device.id.padEnd(14)} ${device.width * device.scale} x ${device.height * device.scale}  ${device.store}`,
  );
}
await browser.close();
console.log(
  `\n${devices.length * shots.length} screenshots in ${path.relative(process.cwd(), out)}`,
);
