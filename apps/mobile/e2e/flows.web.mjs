// The Maestro flows (.maestro/*.yaml), run against the browser build with
// Playwright: a mock exam, a practice session, flashcards, and the plans
// screen. They exercise the same screens and the same engine, but not the
// phone: a stand-in for machines without a simulator, not a replacement.
//
//   pnpm --filter @oathly/mobile web          (with a test session, see README.md)
//   node e2e/flows.web.mjs [http://localhost:8081]

import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:8081';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const problems = [];
page.on('pageerror', (error) => problems.push(String(error)));

const byId = (id) => page.locator(`[data-testid="${id}"]`);
const byPrefix = (prefix) => page.locator(`[data-testid^="${prefix}"]`);
const visible = async (locator) =>
  (await locator.count()) > 0 && (await locator.first().isVisible());

/** shared/open.yaml: the Study tab, by way of onboarding for a brand-new test learner. */
async function open() {
  await page.goto(base, { waitUntil: 'load', timeout: 120_000 });
  await Promise.race([
    byId('finish-onboarding').waitFor({ timeout: 120_000 }),
    byPrefix('practise-').first().waitFor({ timeout: 120_000 }),
  ]);
  if (await byId('finish-onboarding').count()) {
    await byPrefix('country-').first().click();
    await byId('finish-onboarding').click();
  }
  await byPrefix('practise-').first().waitFor({ timeout: 60_000 });
}

/** A session that reads its questions aloud is switched to the written form: these flows tap. */
async function writtenForm() {
  await byId('audio-mode').waitFor({ timeout: 30_000 });
  if (await byId('show-question').count()) await byId('audio-mode').click();
  await byId('question-text').waitFor({ timeout: 30_000 });
}

async function untilResults(step) {
  let steps = 0;
  while (!(await visible(byId('results')))) {
    await step();
    steps += 1;
    if (steps > 200) throw new Error('The session never ended.');
    await page.waitForTimeout(100);
  }
  const heading = await page.getByRole('heading').first().innerText();
  await byId('back-to-study').click();
  await byPrefix('practise-').first().waitFor({ timeout: 30_000 });
  return { steps, heading };
}

const flows = {
  // mock-exam.yaml: no feedback between questions.
  'mock exam': async () => {
    await byPrefix('mock-exam-').first().click();
    await writtenForm();
    return untilResults(async () => {
      await byId('option-0').click();
      await byId('next').click();
    });
  },
  // practice.yaml: each answer is checked, then the next question.
  practice: async () => {
    await byPrefix('practise-').first().click();
    await writtenForm();
    return untilResults(async () => {
      await byId('option-0').click();
      await byId('check').click();
      await byId('next').click();
    });
  },
  // flashcards.yaml
  flashcards: async () => {
    await byPrefix('flashcards-').first().click();
    await byId('flashcard').waitFor({ timeout: 30_000 });
    return untilResults(async () => {
      await byId('show-answer').click();
      await byId('knew-it').click();
    });
  },
  // plans.yaml
  plans: async () => {
    await byId('tab-profile').click();
    await byId('profile-plan').waitFor({ timeout: 30_000 });
    await byId('open-plans').click();
    await byId('current-plan').waitFor({ timeout: 30_000 });
    const plan = await byId('current-plan').innerText();
    await byId('plans-back').click();
    await byId('profile-plan').waitFor({ timeout: 30_000 });
    await byId('tab-study').click();
    await byPrefix('practise-').first().waitFor({ timeout: 30_000 });
    return { steps: 1, heading: plan.replace(/\s+/g, ' ').trim() };
  },
};

let failed = false;
await open();
for (const [name, flow] of Object.entries(flows)) {
  try {
    const { steps, heading } = await flow();
    console.log(
      `ok    ${name.padEnd(10)} ${steps} step${steps === 1 ? '' : 's'}, ended on "${heading}"`,
    );
  } catch (error) {
    failed = true;
    console.error(
      `FAIL  ${name}: ${error instanceof Error ? error.message.split('\n')[0] : error}`,
    );
    await open();
  }
}
await browser.close();

if (problems.length > 0) {
  console.error(`Page errors:\n${problems.join('\n')}`);
  failed = true;
}
process.exit(failed ? 1 : 0);
