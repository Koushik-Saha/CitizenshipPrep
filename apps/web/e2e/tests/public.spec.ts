import { FREE_QUESTIONS_PER_COUNTRY, TRIAL_QUESTIONS } from '@oathly/core';
import { expect, test } from '@playwright/test';

import { expectAccessible, expectAccessibleInBothThemes, t } from './support';

// What a visitor sees before signing in: the landing page, the country list,
// a country's test page and a topic's. The fixture country is "Testland".

test('the landing page leads to a country and on to sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('landing.heroTitle'));
  await expect(page).toHaveTitle(t('landing.metaTitle'));
  await page.getByRole('link', { name: 'Testland', exact: true }).first().click();
  await expect(page).toHaveURL(/\/testland\/citizenship-test$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Testland citizenship test');
  await page
    .getByRole('link', { name: t('countries.studyForTest', { country: 'Testland' }) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sign-in\?country=ZZ$/);
});

test('a country whose questions are still being completed is marked Beta, and its pass is not sold', async ({
  page,
}) => {
  // Testland has about 30 questions, short of five mock exams' worth: a half-built country.
  await page.goto('/');
  const card = page.locator('#countries li').filter({ hasText: 'Testland' }).first();
  await expect(card.getByText(t('common.beta'), { exact: true })).toBeVisible();
  const pricing = page.locator('#pricing');
  await expect(pricing.getByText(t('landing.passBetaNote'))).toBeVisible();

  await page.goto('/countries');
  await expect(page.getByText(t('common.beta'), { exact: true }).first()).toBeVisible();

  await page.goto('/testland/citizenship-test');
  await expect(page.getByTestId('country-beta')).toHaveText(t('countries.betaNote'));
  // Its official pool of 30 is all here (other tests may publish a few more),
  // so the page does not speak of a partial pool.
  await expect(page.getByTestId('country-lead')).toHaveText(
    /^\d+ practice questions, each checked against the official guide\.$/,
  );
});

test('a country page shows the exam facts, as many free samples as the Free plan promises, and its topics', async ({
  page,
}) => {
  // The pricing promises a sample of so many questions from each country...
  await page.goto('/#pricing');
  await expect(
    page.getByText(t('plans.freeSummary', { count: FREE_QUESTIONS_PER_COUNTRY })),
  ).toBeVisible();
  // ...and the country's page gives that many.
  await page.goto('/testland/citizenship-test');
  await expect(page.getByRole('heading', { name: 'Testland written test' })).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: t('seo.samplesTitle', { count: FREE_QUESTIONS_PER_COUNTRY }),
    }),
  ).toBeVisible();
  const samples = page.locator('section[aria-labelledby="samples"] ol > li');
  await expect(samples).toHaveCount(FREE_QUESTIONS_PER_COUNTRY);
  // An answer is behind a disclosure until asked for.
  const first = samples.first();
  await expect(first.getByText(t('countries.answerLabel'))).toBeHidden();
  await first.getByText(t('countries.showAnswer')).click();
  await expect(first.getByText(t('countries.answerLabel'))).toBeVisible();

  await page
    .locator('section[aria-labelledby="topics"]')
    .getByRole('link', { name: /History/ })
    .click();
  await expect(page).toHaveURL(/\/testland\/citizenship-test\/history$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('History');
  // A topic page shows its questions up to the same number: Testland's History
  // has 10 (other tests may publish a few more), all of them shown.
  const topicSamples = page.locator('section[aria-labelledby="samples"] ol > li');
  await expect(topicSamples.first()).toBeVisible();
  const shown = await topicSamples.count();
  expect(shown).toBeGreaterThanOrEqual(10);
  expect(shown).toBeLessThanOrEqual(FREE_QUESTIONS_PER_COUNTRY);
});

test('pages come in the reader’s language, with questions translated where reviewed', async ({
  page,
}) => {
  await page.goto('/es/testland/citizenship-test/government');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Government');
  await expect(page.getByText(/^Pregunta \d+ de Testland/).first()).toBeVisible();
  // Arabic reads right to left.
  await page.goto('/ar/countries');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('the site can be installed as an app: every page links its manifest, and its icons load', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  const response = await request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    short_name: 'Swornly',
    display: 'standalone',
    start_url: '/study',
  });
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons as { src: string }[]) {
    const image = await request.get(icon.src);
    expect(image.status(), icon.src).toBe(200);
    expect(image.headers()['content-type'], icon.src).toBe('image/png');
  }
});

test('a shared link in a language opens in that language, whatever was read before', async ({
  page,
}) => {
  // Someone has been reading in Spanish: plain addresses now open in Spanish.
  await page.goto('/es/countries');
  await page.goto('/countries');
  await expect(page).toHaveURL(/\/es\/countries$/);
  // A link shared in English says so, and wins: it opens in English, and the
  // plain addresses after it stay English.
  await page.goto('/en/countries');
  await expect(page).toHaveURL(/\/countries$/);
  await expect(page).not.toHaveURL(/\/es\//);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  // So does a link shared in another language.
  await page.goto('/ar/countries');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
});

test('the privacy policy, the terms and how to delete an account are a link away', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('contentinfo')
    .getByRole('link', { name: t('common.privacy') })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
  await page.getByRole('link', { name: 'how to delete your account' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Delete your Swornly account');
  await page
    .getByRole('contentinfo')
    .getByRole('link', { name: t('common.terms') })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Terms of use');
  await expect(
    page.getByText('not affiliated with, or endorsed by, any government', { exact: true }),
  ).toBeVisible();

  // Read from another language's address: English text, marked as English, and said to be.
  await page.goto('/es/terms');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('article')).toHaveAttribute('lang', 'en');
  await expect(page.getByText(/solo está en inglés/)).toBeVisible();
});

test('old country addresses go to the new pages, and unknown ones are not found', async ({
  page,
  request,
}) => {
  await page.goto('/countries/zz');
  await expect(page).toHaveURL(/\/testland\/citizenship-test$/);
  expect((await request.get('/nowhere/citizenship-test')).status()).toBe(404);
  expect((await request.get('/testland/citizenship-test/no-such-topic')).status()).toBe(404);
});

test('the guessed "/quiz/quick-start" goes to the countries, in the reader\'s language', async ({
  page,
  request,
}) => {
  const response = await request.get('/quiz/quick-start', { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe('/countries');
  await page.goto('/es/quiz/quick-start');
  await expect(page).toHaveURL(/\/es\/countries$/);
});

test('search engines get a sitemap and are kept out of the signed-in pages', async ({
  request,
}) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/testland/citizenship-test</loc>');
  for (const page of ['/contact', '/privacy', '/terms', '/refunds', '/delete-account']) {
    expect(sitemap).toContain(`${page}</loc>`);
  }
  expect(sitemap).toContain('hreflang="es"');
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /study');
  expect(robots).toContain('Sitemap: ');
});

test('signed-out visitors are sent to sign in from the learner pages', async ({ page }) => {
  for (const path of ['/study', '/onboarding', '/org/some-organization', '/study/plans']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/sign-in$/);
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('auth.title'));
  await expect(page.getByLabel(t('auth.email'))).toBeVisible();
});

test('organizations see what they get, what it costs and who to ask, without signing in', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('contentinfo')
    .getByRole('link', { name: t('org.forOrganizations') })
    .click();
  await expect(page).toHaveURL(/\/org$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('org.forOrganizations'));
  for (const feature of ['org.publicInvite', 'org.publicDashboard', 'org.publicPrivacy'] as const) {
    await expect(page.getByText(t(feature))).toBeVisible();
  }
  // The tests' server sells no seats: it says so, and how to ask.
  await expect(page.getByTestId('org-pricing')).toHaveText(t('org.publicPricingSoon'));
  await expect(page.getByRole('link', { name: t('org.publicContact') })).toHaveAttribute(
    'href',
    '/contact',
  );
  await expect(page.getByRole('link', { name: t('org.publicStart') })).toHaveAttribute(
    'href',
    '/sign-in',
  );
  // Crawlers may read it; what is under it stays private.
  const robots = await (await page.request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /org/');
  expect(robots).not.toMatch(/Disallow: \/org$/m);
});

const publicPages = [
  ['/', 'landing'],
  ['/countries', 'country list'],
  ['/org', 'for organizations'],
  ['/testland/citizenship-test', 'country test page'],
  ['/testland/citizenship-test/history', 'topic page'],
  ['/sign-in', 'sign-in'],
  ['/privacy', 'privacy policy'],
  ['/terms', 'terms'],
  ['/refunds', 'refunds and cancelling'],
  ['/delete-account', 'how to delete an account'],
  ['/es/privacy', 'privacy policy, read from Spanish'],
  ['/join/not-a-real-invitation', 'invitation that is gone'],
  ['/this-page-does-not-exist', 'not found'],
  ['/ar/testland/citizenship-test', 'country test page, Arabic'],
  ['/es/testland/citizenship-test/government', 'topic page, Spanish'],
  ['/zh-Hans', 'landing, Chinese'],
] as const;

for (const [path, name] of publicPages) {
  test(`accessibility: ${name}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectAccessibleInBothThemes(page, name);
  });
}

test('without WebGL the landing page keeps its poster and loads no 3D', async ({ page }) => {
  // A browser with no WebGL at all: no context to be had, and no sign of support.
  await page.addInitScript(() => {
    // @ts-expect-error removing it is the point
    delete window.WebGL2RenderingContext;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...rest: unknown[]) {
      if (kind.includes('webgl')) return null;
      // @ts-expect-error passing the call through unchanged
      return original.call(this, kind, ...rest);
    } as typeof original;
  });
  const scripts: string[] = [];
  page.on('requestfinished', (request) => scripts.push(new URL(request.url()).pathname));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('landing.heroTitle'));
  const poster = page.locator('img[src*="globe"]').first();
  await expect(poster).toBeVisible();
  expect(
    await poster.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
  ).toBe(true);

  // Longer than the page waits before it would start the 3D: it never does.
  await page.waitForTimeout(7000);
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(poster).toBeVisible();
  expect(scripts.filter((path) => /\.(glb|ktx2|wasm)$/.test(path))).toEqual([]);
  expect(errors).toEqual([]);
});

test('when the sign-in service refuses or cannot be reached, the form says so and stays', async ({
  page,
}) => {
  // The tests' server points sign-in at an address where nothing listens.
  await page.goto('/sign-in');
  await page.getByLabel(t('auth.email')).fill('someone@example.test');
  await page.getByRole('button', { name: t('auth.sendCode') }).click();
  await expect(page.getByRole('alert').filter({ hasText: t('auth.sendFailed') })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('auth.title'));

  // The service has not been told about this site's address: said plainly,
  // and the page does not fail.
  await page.route('**/api/auth/email-otp/send-verification-otp', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid origin', code: 'INVALID_ORIGIN' }),
    }),
  );
  await page.getByLabel(t('auth.email')).fill('someone@example.test');
  await page.getByRole('button', { name: t('auth.sendCode') }).click();
  await expect(page.getByRole('alert').filter({ hasText: t('auth.notConfigured') })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('auth.title'));
});

test('an uptime monitor has an address to ask, which says only whether the site is up', async ({
  request,
}) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
  expect(response.headers()['cache-control']).toBe('no-store');
});

test('the refunds page is linked from the footer and from the terms', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('contentinfo')
    .getByRole('link', { name: t('common.refunds') })
    .click();
  await expect(page).toHaveURL(/\/refunds$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Refunds and cancelling');
  await page.goto('/terms');
  await expect(page.getByRole('link', { name: 'refunds page' })).toHaveAttribute(
    'href',
    '/refunds',
  );
});

test('a visitor plays a round of real practice without an account', async ({ page }) => {
  await page.goto('/testland/citizenship-test');
  await page
    .getByRole('link', { name: t('trial.cta', { count: TRIAL_QUESTIONS }) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/testland\/citizenship-test\/try$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    t('trial.title', { country: 'Testland' }),
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  // The first answer wrong, the rest right; each is checked and explained at once.
  for (let i = 0; i < TRIAL_QUESTIONS; i += 1) {
    await expect(
      page.getByText(t('session.questionOf', { current: i + 1, total: TRIAL_QUESTIONS })),
    ).toBeVisible();
    const text = await page.getByRole('heading', { level: 2 }).first().innerText();
    const n = Number(/what is (\d+) plus/.exec(text)?.[1]);
    const answer = page.locator('span[lang]').getByText(String(2 * n), { exact: true });
    const pick =
      i === 0
        ? page.getByRole('radio').filter({ hasNot: answer }).first()
        : page.getByRole('radio').filter({ has: answer });
    await pick.click();
    if (i === 0) await expectAccessibleInBothThemes(page, 'trial question');
    await page.getByRole('button', { name: t('session.check'), exact: true }).click();
    await expect(
      page.getByText(i === 0 ? t('session.notQuite') : t('session.correct')).first(),
    ).toBeVisible();
    await expect(page.getByText(`${n} plus ${n} is ${2 * n}.`).first()).toBeVisible();
    await page
      .getByRole('button', {
        name: i + 1 === TRIAL_QUESTIONS ? t('session.seeResults') : t('session.nextQuestion'),
        exact: true,
      })
      .click();
  }

  const results = page.getByTestId('trial-results');
  await expect(results.getByRole('heading')).toHaveText(
    t('trial.doneTitle', { correct: TRIAL_QUESTIONS - 1, total: TRIAL_QUESTIONS }),
  );
  await expectAccessible(page, 'trial results');
  await expect(results.getByRole('link', { name: t('trial.signUp') })).toHaveAttribute(
    'href',
    '/sign-in?country=ZZ',
  );
  // Nothing was asked of the visitor, and the round can be played again.
  await results.getByRole('button', { name: t('common.tryAgain') }).click();
  await expect(
    page.getByText(t('session.questionOf', { current: 1, total: TRIAL_QUESTIONS })),
  ).toBeVisible();
});

test('the landing page offers each country with questions a round to try', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('#countries li')
    .filter({ hasText: 'Testland' })
    .first()
    .getByRole('link', { name: t('trial.cta', { count: TRIAL_QUESTIONS }) })
    .click();
  await expect(page).toHaveURL(/\/testland\/citizenship-test\/try$/);
  await expect(page.getByRole('radio')).toHaveCount(4);
});

test('an address with no page says so inside the site, with its header and footer', async ({
  page,
}) => {
  const response = await page.goto('/nonexistent-page-qa-test');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('common.notFoundTitle'));
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expectAccessible(page, 'not found');
  // The navigation works from here, in the reader's language too.
  await page
    .getByRole('navigation', { name: t('common.mainNav') })
    .getByRole('link', { name: t('common.countries') })
    .click();
  await expect(page).toHaveURL(/\/countries$/);
  await page.goto('/es/nonexistent-page-qa-test');
  await expect(
    page.getByRole('contentinfo').getByRole('link', { name: 'Contacto' }),
  ).toHaveAttribute('href', '/es/contact');
});

// Nor two bullets with the same words: a page reader that drops repeated text
// showed the second of a pair as an empty bullet.
test('the pricing section has no empty or repeated bullet, in any language', async ({ page }) => {
  for (const prefix of ['', '/es', '/ar', '/zh-Hans']) {
    await page.goto(`${prefix}/`);
    const bullets = (await page.locator('#pricing li').allInnerTexts()).map((text) => text.trim());
    expect(bullets, `${prefix || 'en'} pricing`).not.toContain('');
    expect(new Set(bullets).size, `${prefix || 'en'} pricing, all different`).toBe(bullets.length);
  }
});
