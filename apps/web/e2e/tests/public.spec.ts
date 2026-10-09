import { expect, test } from '@playwright/test';

import { expectAccessibleInBothThemes, t } from './support';

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

test('a country page shows the exam facts, ten samples with answers, and its topics', async ({
  page,
}) => {
  await page.goto('/testland/citizenship-test');
  await expect(page.getByRole('heading', { name: 'Testland written test' })).toBeVisible();
  const samples = page.locator('section[aria-labelledby="samples"] ol > li');
  await expect(samples).toHaveCount(10);
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
  await expect(page.locator('section[aria-labelledby="samples"] ol > li')).toHaveCount(10);
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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Delete your Oathly account');
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

test('search engines get a sitemap and are kept out of the signed-in pages', async ({
  request,
}) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/testland/citizenship-test</loc>');
  expect(sitemap).toContain('hreflang="es"');
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /study');
  expect(robots).toContain('Sitemap: ');
});

test('signed-out visitors are sent to sign in from the learner pages', async ({ page }) => {
  for (const path of ['/study', '/onboarding', '/org', '/study/plans']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/sign-in$/);
  }
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('auth.title'));
  await expect(page.getByLabel(t('auth.email'))).toBeVisible();
});

const publicPages = [
  ['/', 'landing'],
  ['/countries', 'country list'],
  ['/testland/citizenship-test', 'country test page'],
  ['/testland/citizenship-test/history', 'topic page'],
  ['/sign-in', 'sign-in'],
  ['/privacy', 'privacy policy'],
  ['/terms', 'terms'],
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
