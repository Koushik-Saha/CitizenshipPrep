import { expect, test, type Route, type Page } from '@playwright/test';

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
  // Nobody starts without confirming their age and accepting the terms: the
  // form holds them here, and the server refuses whoever goes round the form.
  const accept = page.getByRole('checkbox', { name: t('onboarding.acceptTerms', { age: 16 }) });
  await expect(accept).not.toBeChecked();
  await page.getByRole('button', { name: t('onboarding.start') }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  const answers = { countryCode: 'ZZ', examDate: null, studyLocale: 'en', dailyGoalMinutes: 15 };
  const refused = await page.request.post('/api/me/onboarding', { data: answers });
  expect(refused.status()).toBe(400);
  expect((await refused.json()).error).toContain('16 or older');
  // The terms and the policy can be read from here, without losing the form.
  await expect(page.getByRole('link', { name: t('onboarding.termsLink') })).toHaveAttribute(
    'href',
    '/terms',
  );
  await expect(page.getByRole('link', { name: t('onboarding.privacyLink') })).toHaveAttribute(
    'href',
    '/privacy',
  );

  await accept.check();
  await page.getByRole('button', { name: t('onboarding.start') }).click();
  await expect(page).toHaveURL(/\/study$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Testland' })).toBeVisible();
  // Asked once: adding another exam later does not ask again.
  await page.goto('/onboarding?add=1');
  await expect(accept).toHaveCount(0);
  await page.goto('/study');
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

test('answering never waits for the network', async ({ page }) => {
  await signInAndOnboard(page);
  await page.getByRole('button', { name: t('dashboard.practise'), exact: true }).click();
  await expect(page).toHaveURL(/\/study\/session\/[0-9a-f-]{36}$/);

  // Hold every answer on its way to the server, as a dead connection would,
  // and count what the server has been allowed to hear.
  const held: Route[] = [];
  let holding = true;
  let reached = 0;
  await page.route('**/api/answers', (route) => {
    if (holding) held.push(route);
    else void route.continue();
  });
  page.on('requestfinished', (request) => {
    if (request.method() !== 'GET' && new URL(request.url()).pathname.startsWith('/api/')) {
      reached += 1;
    }
  });

  // Three questions answered, checked and moved on from, with nothing getting through.
  for (let i = 0; i < 3; i += 1) {
    await option(page, await rightAnswer(page)).click();
    await page.getByRole('button', { name: t('session.check'), exact: true }).click();
    await expect(page.getByText(t('session.correct')).first()).toBeVisible();
    await page.getByRole('button', { name: t('session.nextQuestion'), exact: true }).click();
  }
  await expect.poll(() => held.length, 'answers are sent in the background').toBeGreaterThan(0);
  expect(reached, 'nothing was waited for').toBe(0);

  // The connection comes back: what was held is delivered and the session can finish.
  holding = false;
  await Promise.all(held.map((route) => route.continue()));
  for (let i = 0; ; i += 1) {
    await option(page, await rightAnswer(page)).click();
    await page.getByRole('button', { name: t('session.check'), exact: true }).click();
    await expect(page.getByText(t('session.correct')).first()).toBeVisible();
    const last = page.getByRole('button', { name: t('session.seeResults'), exact: true });
    if (await last.isVisible()) {
      await last.click();
      break;
    }
    await page.getByRole('button', { name: t('session.nextQuestion'), exact: true }).click();
    expect(i, 'the session ends').toBeLessThan(40);
  }
  await expect(page.getByRole('heading', { level: 1, name: t('results.complete') })).toBeVisible();
  expect(reached, 'the held answers arrived').toBeGreaterThan(0);
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

test('a buy button on the landing page leads to the plans page, through sign-up if need be', async ({
  page,
  browser,
}) => {
  // Someone signed out: each button goes to sign-in and names the plan.
  const visitor = await browser.newPage();
  await visitor.goto('/#pricing');
  for (const [name, plan] of [
    [t('plans.getYearly'), 'pro_yearly'],
    [t('plans.getMonthly'), 'pro_monthly'],
    [t('plans.getAPass'), 'country_pass'],
  ] as const) {
    await expect(visitor.getByRole('link', { name, exact: true })).toHaveAttribute(
      'href',
      `/sign-in?plan=${plan}`,
    );
  }
  await visitor.close();

  // Someone new presses one, signs up and sets up their study: the plans come next.
  const user = newLearner();
  await page.goto(`/api/test/sign-in?user=${user}&secret=${process.env.TEST_SIGN_IN_SECRET}`);
  await page.waitForURL(/\/onboarding/);
  await page.goto('/sign-in?plan=country_pass');
  await page.waitForURL(/\/onboarding\?plan=country_pass/);
  await page.getByRole('radio', { name: /Testland/ }).check();
  await page.getByRole('checkbox', { name: t('onboarding.acceptTerms', { age: 16 }) }).check();
  await page.getByRole('button', { name: t('onboarding.start') }).click();
  await page.waitForURL(/\/study\/plans\?plan=country_pass#pass$/);
  await expect(page.getByRole('heading', { name: t('plans.countryPass') })).toBeVisible();

  // Already set up: straight to the plan that was picked.
  await page.goto('/#pricing');
  await page.getByRole('link', { name: t('plans.getYearly'), exact: true }).click();
  await page.waitForURL(/\/study\/plans\?plan=pro_yearly#pro$/);
  // A plan that is not sold is not carried anywhere.
  await page.goto('/sign-in?plan=https://elsewhere.example');
  await page.waitForURL(/\/study$/);
});

test('wherever a learner studies, the page says Oathly is independent and links to its terms', async ({
  page,
}) => {
  await signInAndOnboard(page);
  for (const path of ['/study', '/study/plans', '/study/account']) {
    await page.goto(path);
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByText(t('common.notAffiliated')), path).toBeVisible();
    for (const [name, href] of [
      [t('common.terms'), '/terms'],
      [t('common.privacy'), '/privacy'],
      [t('common.refunds'), '/refunds'],
      [t('common.contact'), '/contact'],
    ] as const) {
      await expect(footer.getByRole('link', { name, exact: true }), path).toHaveAttribute(
        'href',
        href,
      );
    }
  }
  // In a session too, where the answers are.
  await page.goto('/study');
  await page.getByRole('button', { name: t('dashboard.practise'), exact: true }).click();
  await expect(page).toHaveURL(/\/study\/session\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('contentinfo').getByText(t('common.notAffiliated'))).toBeVisible();
});

test('a learner changes their name, takes a copy of their data, and opts out of statistics', async ({
  page,
  request,
}) => {
  const user = await signInAndOnboard(page);
  await page.goto('/study/account');

  // A name of their own, shown at once.
  await page.getByLabel(t('profile.nameLabel')).fill('  Maria   Silva ');
  await page.getByRole('button', { name: t('profile.nameSave') }).click();
  await expect(page.getByRole('status').filter({ hasText: t('profile.nameSaved') })).toBeVisible();
  await expect(page.getByLabel(t('profile.nameLabel'))).toHaveValue('Maria Silva');
  // A name may not carry a link: refused, and the old one stays.
  await page.getByLabel(t('profile.nameLabel')).fill('Visit https://spam.example');
  await page.getByRole('button', { name: t('profile.nameSave') }).click();
  await expect(page.getByRole('alert').filter({ hasText: t('profile.nameProblem') })).toBeVisible();
  await expect(page.getByLabel(t('profile.nameLabel'))).toHaveValue('Maria Silva');
  await expectAccessibleInBothThemes(page, 'account');

  // A copy of their data: a file, holding their account and what they study, and nobody else's.
  await expect(page.getByRole('link', { name: t('profile.exportButton') })).toHaveAttribute(
    'href',
    '/api/me/export',
  );
  const copy = await page.request.get('/api/me/export');
  expect(copy.status()).toBe(200);
  expect(copy.headers()['content-disposition']).toMatch(/^attachment; filename="oathly-data-/);
  const data = (await copy.json()) as {
    account: { id: string; displayName: string };
    data: Record<string, { country_code?: string }[]>;
  };
  expect(data.account).toMatchObject({ id: `test:${user}`, displayName: 'Maria Silva' });
  expect(data.data.user_countries).toMatchObject([{ country_code: 'ZZ' }]);
  expect(JSON.stringify(data)).not.toContain('test:e2e-warm-up');
  // Nobody signed out gets anyone's.
  expect((await request.get('/api/me/export')).status()).toBe(401);

  // Their use is counted until they say otherwise, and again when they change their mind.
  await page.getByRole('button', { name: t('profile.analyticsStop') }).click();
  await expect(page.getByText(t('profile.analyticsStopped'))).toBeVisible();
  await page.getByRole('button', { name: t('profile.analyticsStart') }).click();
  await expect(page.getByText(t('profile.analyticsStopped'))).toHaveCount(0);
  await expect(page.getByRole('button', { name: t('profile.analyticsStop') })).toBeVisible();
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

test('a learner is told plainly when AI help cannot be reached, and keeps their question', async ({
  page,
}) => {
  // This server has no AI model, which is what an account with no credit looks like.
  await signInAndOnboard(page);
  await page.goto('/study/tutor/zz');
  const box = page.getByRole('textbox');
  await box.fill('How many members does the council have?');
  await page.getByRole('button', { name: t('tutor.ask'), exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: t('tutor.unavailable') })).toBeVisible();
  await expect(box).toHaveValue('How many members does the council have?');

  // The same for an explanation: an answer the page can read, not a broken reply.
  const pack = await (await page.request.get('/api/packs/ZZ')).json();
  const explained = await page.request.post('/api/explain', {
    data: { questionId: pack.questions[0].id },
    headers: { 'content-type': 'application/json' },
  });
  expect(explained.status()).toBe(503);
  expect((await explained.json()).code).toBe('AI_UNAVAILABLE');
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
