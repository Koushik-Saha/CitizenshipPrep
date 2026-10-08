import { expect, test, type Page } from '@playwright/test';

import {
  daysFromNow,
  expectAccessible,
  expectAccessibleInBothThemes,
  signIn,
  signInAndOnboard,
  newLearner,
  t,
} from './support';

// A learner's path through the app: setting up, practising, a mock exam,
// saying how the real exam went. Each test is someone new, so they do not
// trip over each other. The fixture questions ask "what is N plus N?".

/** The right answer to the fixture question on screen: twice its number. */
async function rightAnswer(page: Page): Promise<string> {
  const text = await page.getByRole('heading', { level: 1 }).first().innerText();
  const n = Number(/what is (\d+) plus/.exec(text)?.[1]);
  expect(n, `a fixture question: "${text}"`).toBeGreaterThan(0);
  return String(2 * n);
}

/** The option that says exactly this (each also shows the key that picks it). */
const option = (page: Page, text: string) =>
  page
    .getByRole('radio')
    .filter({ has: page.locator('span[lang]').getByText(text, { exact: true }) });

/** Any option that does not. */
const otherOption = (page: Page, text: string) =>
  page
    .getByRole('radio')
    .filter({ hasNot: page.locator('span[lang]').getByText(text, { exact: true }) })
    .first();

test('a new learner sets up their study and lands on the dashboard', async ({ page }) => {
  await signIn(page, newLearner());
  await expect(page).toHaveURL(/\/onboarding$/);
  await expectAccessibleInBothThemes(page, 'onboarding');

  await page.getByRole('radio', { name: /Testland/ }).check();
  await page.getByRole('button', { name: t('onboarding.start') }).click();
  await expect(page).toHaveURL(/\/study$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Testland' })).toBeVisible();
  await expectAccessibleInBothThemes(page, 'dashboard');
});

test('a practice session checks each answer and ends with results', async ({ page }) => {
  await signInAndOnboard(page);
  await page.getByRole('button', { name: t('dashboard.practise'), exact: true }).click();
  await expect(page).toHaveURL(/\/study\/session\/[0-9a-f-]{36}$/);

  // Right, then wrong, then right for the rest: both kinds of feedback.
  for (let i = 0; ; i += 1) {
    const answer = await rightAnswer(page);
    const pick = i === 1 ? otherOption(page, answer) : option(page, answer);
    await pick.click();
    if (i === 0) await expectAccessibleInBothThemes(page, 'practice question');
    await page.getByRole('button', { name: t('session.check'), exact: true }).click();
    await expect(
      page.getByText(i === 1 ? t('session.notQuite') : t('session.correct')).first(),
    ).toBeVisible();
    if (i === 1) await expectAccessible(page, 'practice question, answered');
    const last = page.getByRole('button', { name: t('session.seeResults'), exact: true });
    if (await last.isVisible()) {
      await last.click();
      break;
    }
    await page.getByRole('button', { name: t('session.nextQuestion'), exact: true }).click();
    expect(i, 'the session ends').toBeLessThan(40);
  }

  await expect(page.getByRole('heading', { level: 1, name: t('results.complete') })).toBeVisible();
  await expect(page.getByText(t('results.reviewWrong'))).toBeVisible();
  await expectAccessibleInBothThemes(page, 'practice results');

  // Back on the dashboard, the session counts.
  await page
    .getByRole('link', { name: t('common.backToStudy') })
    .first()
    .click();
  await expect(page).toHaveURL(/\/study$/);
});

test('a mock exam answered correctly is a pass', async ({ page }) => {
  await signInAndOnboard(page);
  await page
    .getByRole('button', { name: t('start.startMock'), exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/study\/session\//);

  for (let i = 0; ; i += 1) {
    const answer = await rightAnswer(page);
    await option(page, answer).click();
    if (i === 0) await expectAccessible(page, 'mock exam question');
    const submit = page.getByRole('button', { name: t('session.submitExam'), exact: true });
    if (await submit.isVisible()) {
      await submit.click();
      break;
    }
    await page.getByRole('button', { name: t('session.next'), exact: true }).click();
    expect(i, 'the exam ends').toBeLessThan(40);
  }
  await expect(page.getByRole('heading', { level: 1, name: t('results.passed') })).toBeVisible();
  await expectAccessibleInBothThemes(page, 'mock exam results');
});

test('a spoken exam opens as a mock interview', async ({ page }) => {
  await signInAndOnboard(page);
  await page
    .getByRole('button', { name: t('audio.startInterview'), exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/study\/session\//);
  await expect(page.getByText(t('audio.interviewIntro'))).toBeVisible();
  await expectAccessibleInBothThemes(page, 'mock interview');
  // The question's words are out of sight until asked for.
  await page.getByRole('button', { name: t('audio.showQuestion') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Testland question');
  await expectAccessible(page, 'mock interview, question shown');
});

test('flashcards turn over and are rated', async ({ page }) => {
  await signInAndOnboard(page);
  await page.getByRole('button', { name: t('start.flashcards'), exact: true }).click();
  await expect(page).toHaveURL(/\/study\/session\//);
  await expectAccessible(page, 'flashcard, front');
  await page.getByRole('button', { name: t('session.showAnswer'), exact: true }).click();
  await expectAccessible(page, 'flashcard, back');
  await page.getByRole('button', { name: new RegExp(t('session.knewIt')) }).click();
  await expect(page.getByText(t('session.questionOf', { current: 2, total: 10 }))).toBeVisible();
});

test('once the exam date has come, the learner is asked how it went', async ({ page }) => {
  await signInAndOnboard(page, { examDate: daysFromNow(0) });
  const ask = page.getByTestId('exam-result-ask-ZZ');
  await expect(ask).toContainText(t('dashboard.examResultAsk', { country: 'Testland' }));
  await expectAccessibleInBothThemes(page, 'dashboard, asking for the exam result');

  await ask.getByRole('button', { name: t('dashboard.examResultPassed') }).click();
  const said = page.getByTestId('exam-result-passed-ZZ');
  await expect(said).toHaveText(t('dashboard.examResultCongrats', { country: 'Testland' }));
  await expect(ask).toBeHidden();
  // It is remembered.
  await page.reload();
  await expect(said).toBeVisible();
  await expectAccessible(page, 'dashboard, exam passed');
});

test('a learner who did not pass is thanked, and nobody is asked before their date', async ({
  page,
}) => {
  await signInAndOnboard(page, { examDate: daysFromNow(0) });
  await page.getByRole('button', { name: t('dashboard.examResultFailed') }).click();
  await expect(page.getByTestId('exam-result-failed-ZZ')).toHaveText(
    t('dashboard.examResultRetake'),
  );

  await page.context().clearCookies();
  await signInAndOnboard(page, { examDate: daysFromNow(30) });
  await expect(page.getByRole('heading', { level: 2, name: 'Testland' })).toBeVisible();
  await expect(page.getByTestId('exam-result-ask-ZZ')).toHaveCount(0);
});

test('the plans page and the tutor are reachable and accessible', async ({ page }) => {
  await signInAndOnboard(page);
  await page.getByRole('link', { name: t('plans.title'), exact: true }).click();
  await expect(page).toHaveURL(/\/study\/plans$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectAccessibleInBothThemes(page, 'plans');

  await page.goto('/study/tutor/zz');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectAccessibleInBothThemes(page, 'tutor');
});

test('the study pages work in a right-to-left language', async ({ page }) => {
  await signInAndOnboard(page);
  await page.goto('/ar/study');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await expectAccessible(page, 'dashboard, Arabic');
});

test('a session that is not the learner’s, or not a session, is not found', async ({ page }) => {
  await signInAndOnboard(page);
  for (const id of ['not-an-id', '00000000-0000-4000-8000-000000000000']) {
    await page.goto(`/study/session/${id}`);
    await expect(page.getByRole('heading', { level: 1 }), id).toHaveText(t('common.notFoundTitle'));
  }
  await expectAccessible(page, 'not found, signed in');
});

test('a learner deletes their account, and it is gone', async ({ page }) => {
  await signInAndOnboard(page);
  await page.getByRole('link', { name: t('common.account'), exact: true }).click();
  await expect(page).toHaveURL(/\/study\/account$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('common.account'));
  await expectAccessibleInBothThemes(page, 'account');

  // Nothing happens until the learner says they understand.
  const remove = page.getByRole('button', { name: t('profile.deleteButton') });
  await expect(remove).toBeDisabled();
  await page.getByLabel(t('profile.deleteConfirm')).check();
  await remove.click();

  await expect(page).toHaveURL(/\/account-deleted$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('profile.deletedTitle'));
  await expectAccessibleInBothThemes(page, 'account deleted');

  // Signed out, and nothing of them is left to sign back in to.
  await page.goto('/study');
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await page.request.get('/api/me')).status()).toBe(401);
});
