import { expect, test, type Page } from '@playwright/test';
import { translatorFor } from '@oathly/i18n/messages';

import { signInAndOnboard, t } from './support';

// The learner's path on a small phone (360px wide, touch): nothing runs off
// the side of the screen, and everything to tap is at least 44px tall. Most
// learners study on a phone.

test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });

const ar = translatorFor('ar');

/**
 * What is wrong with the page's layout for a phone: how far it is wider than
 * the screen, and the controls too short to tap easily. A link inside running
 * text is exempt, as is a check box whose label is the target.
 */
async function phoneProblems(page: Page) {
  return page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const short: string[] = [];
    for (const element of document.querySelectorAll(
      'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=radio]',
    )) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (element.tagName === 'A' && element.closest('p, dd')) continue;
      const label = element.closest('label');
      if (label && label.getBoundingClientRect().height >= 44) continue;
      if (box.height < 44) {
        const text = (element.textContent || element.getAttribute('aria-label') || '').trim();
        short.push(
          `${element.tagName.toLowerCase()} "${text.slice(0, 40)}" ${Math.round(box.height)}px`,
        );
      }
    }
    return { overflow, short };
  });
}

async function expectFitsAPhone(page: Page, where: string) {
  expect(await phoneProblems(page), where).toEqual({ overflow: 0, short: [] });
}

/** The right answer to the fixture question on screen: twice its number. */
async function rightAnswer(page: Page): Promise<string> {
  const text = await page.getByRole('heading', { level: 1 }).first().innerText();
  return String(2 * Number(/what is (\d+) plus/.exec(text)?.[1]));
}

test('the public pages fit a small phone', async ({ page }) => {
  await page.goto('/');
  await expectFitsAPhone(page, 'home');
  await page.goto('/testland/citizenship-test');
  for (const answer of await page.locator('section[aria-labelledby="samples"] summary').all()) {
    await answer.tap();
  }
  await expectFitsAPhone(page, 'country page, every sample open');
  await page.goto('/testland/citizenship-test/try');
  await page.getByRole('radio').first().tap();
  await page.getByRole('button', { name: t('session.check'), exact: true }).tap();
  await expectFitsAPhone(page, 'trial, answered');
  await page.goto('/sign-in');
  await expectFitsAPhone(page, 'sign-in');
  await page.goto('/ar');
  await expectFitsAPhone(page, 'home in Arabic');
});

test('studying fits a small phone and is done by tapping', async ({ page }) => {
  test.setTimeout(120_000);
  await signInAndOnboard(page);
  await expectFitsAPhone(page, 'dashboard');

  await page.getByRole('button', { name: t('dashboard.practise'), exact: true }).tap();
  await expect(page).toHaveURL(/\/study\/session\//);
  await page
    .getByRole('radio')
    .filter({ has: page.locator('span[lang]').getByText(await rightAnswer(page), { exact: true }) })
    .tap();
  await expectFitsAPhone(page, 'practice question');
  await page.getByRole('button', { name: t('session.check'), exact: true }).tap();
  await expect(page.getByText(t('session.correct')).first()).toBeVisible();
  await expectFitsAPhone(page, 'practice feedback');

  await page.goto('/study');
  await page.getByRole('button', { name: t('start.flashcards'), exact: true }).tap();
  await page.getByRole('button', { name: t('session.showAnswer'), exact: true }).tap();
  // Both verdicts are within the first screen, in reach of a thumb.
  for (const verdict of [t('session.didNotKnow'), t('session.knewIt')]) {
    const box = await page.getByRole('button', { name: new RegExp(verdict) }).boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(800);
  }
  await expectFitsAPhone(page, 'flashcard, turned over');

  // A mock interview in a browser with no microphone: its controls are still there to tap.
  await page.goto('/study');
  await page
    .getByRole('button', { name: t('audio.startInterview'), exact: true })
    .first()
    .tap();
  await page.getByRole('button', { name: t('audio.showQuestion') }).tap();
  await expectFitsAPhone(page, 'mock interview');

  await page.goto('/study/plans');
  await expectFitsAPhone(page, 'plans');

  // The study group, and a post in it.
  await page.goto('/study/community');
  await expectFitsAPhone(page, 'study group');
  await page.getByText(t('community.newPost'), { exact: true }).tap();
  await page.getByLabel(t('community.titleLabel')).fill('How long did you study each day?');
  await page
    .getByLabel(t('community.bodyLabel'))
    .fill('I have six weeks before my test. How long did you study each day?');
  await page.getByRole('button', { name: t('community.post'), exact: true }).tap();
  await expect(page).toHaveURL(/\/study\/community\/[0-9a-f-]{36}/);
  await expectFitsAPhone(page, 'study group post');

  // Right to left: the same, mirrored.
  await page.goto('/ar/study');
  const practise = page.getByRole('button', { name: ar('dashboard.practise'), exact: true });
  await practise.first().tap();
  await page.getByRole('radio').first().tap();
  await page.getByRole('button', { name: ar('session.check'), exact: true }).tap();
  await expectFitsAPhone(page, 'practice in Arabic');
  const [first, check] = await Promise.all([
    page.getByRole('radio').first().boundingBox(),
    page
      .getByRole('button', { name: /./ })
      .filter({ hasText: ar('session.nextQuestion') })
      .boundingBox(),
  ]);
  // The first button of a row sits at the right-hand edge.
  expect(check!.x + check!.width).toBeCloseTo(first!.x + first!.width, 0);
});
