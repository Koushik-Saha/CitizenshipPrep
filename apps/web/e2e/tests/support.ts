import { randomUUID } from 'node:crypto';

import AxeBuilder from '@axe-core/playwright';
import { totpCode, totpStep } from '@oathly/api/totp';
import { translatorFor } from '@oathly/i18n/messages';
import { expect, type Page } from '@playwright/test';
import jsQR from 'jsqr';

import { makeStaff } from '../database';

/** The app's own English words, so a test names a button by what the app calls it. */
export const t = translatorFor('en');

const secret = () => process.env.TEST_SIGN_IN_SECRET!;

/** A learner nobody has been before: each test that changes things gets its own. */
export const newLearner = () => `e2e-${randomUUID().slice(0, 12)}`;

/** Becomes a learner through the development-only test sign-in. Lands on /welcome's destination. */
export async function signIn(page: Page, user: string): Promise<void> {
  await page.goto(`/api/test/sign-in?user=${user}&secret=${secret()}`);
  await page.waitForURL(/\/(onboarding|study)/);
}

/** Signs in as someone new and takes them through onboarding for the fixture country. */
export async function signInAndOnboard(
  page: Page,
  options: { user?: string; examDate?: string } = {},
): Promise<string> {
  const user = options.user ?? newLearner();
  await signIn(page, user);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('radio', { name: /Testland/ }).check();
  if (options.examDate) await page.locator('input[name="examDate"]').fill(options.examDate);
  await page.getByRole('button', { name: t('onboarding.start') }).click();
  await page.waitForURL(/\/study$/);
  return user;
}

/** "YYYY-MM-DD", some days from today. */
export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Checks the page against WCAG 2.1 A and AA with axe, in the colours it is
 * showing now. Any violation fails the test, whatever axe rates it.
 */
export async function expectAccessible(page: Page, name: string): Promise<void> {
  // A page's title arrives a moment after its content when it is navigated
  // to; every page has to end up with one.
  await expect(page, `${name}: has a title`).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Next's development overlay is not part of the app.
    .exclude('nextjs-portal')
    .analyze();
  const violations = results.violations.map(
    (violation) =>
      `${violation.impact}: ${violation.id} (${violation.help})\n` +
      violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n'),
  );
  expect(violations, `${name}: accessibility violations`).toEqual([]);
}

/** expectAccessible in the light theme and then the dark one. */
export async function expectAccessibleInBothThemes(page: Page, name: string): Promise<void> {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    // Colours fade from one theme to the other: measure them once they have
    // arrived. A fade that starts inside a closed <details> is dropped by the
    // browser without ever finishing, so the wait is bounded.
    await page.evaluate(() =>
      Promise.race([
        Promise.allSettled(document.getAnimations().map((animation) => animation.finished)),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]),
    );
    await expectAccessible(page, `${name} (${scheme})`);
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

/** A network address of its own: tries at the reviewers' sign-in are limited per address. */
export const ownAddress = () =>
  `192.0.2.${1 + Math.floor(Math.random() * 250)}, 10.1.${Math.floor(Math.random() * 250)}.1`;

/** The code an authenticator set up with `key` shows now, or `stepsAhead` codes later. */
export const authenticatorCode = (key: string, stepsAhead = 0) =>
  totpCode(key.replace(/\s/g, ''), totpStep(new Date()) + stepsAhead);

/**
 * The key on the authenticator set-up screen. It sits behind "Cannot scan
 * it?", under the QR code, so it is read from the page rather than from what
 * is showing.
 */
export const setupKey = async (page: Page) =>
  ((await page.getByTestId('totp-secret').textContent()) ?? '').trim();

/**
 * What the QR code on the set-up screen says when a phone scans it: the
 * picture is drawn at a size a camera would see and read back.
 */
export async function scanSetupCode(page: Page): Promise<string | null> {
  const image = await page.getByTestId('totp-qr').evaluate(async (element) => {
    const img = element as HTMLImageElement;
    await img.decode();
    const size = 416;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;
    context.imageSmoothingEnabled = false;
    context.drawImage(img, 0, 0, size, size);
    return { size, data: Array.from(context.getImageData(0, 0, size, size).data) };
  });
  return jsQR(new Uint8ClampedArray(image.data), image.size, image.size)?.data ?? null;
}

/** Signs in to the site as a new account that holds a staff role. Returns its id. */
export async function signInAsStaffAccount(
  page: Page,
  role: 'admin' | 'reviewer' = 'admin',
): Promise<string> {
  const user = `e2e-staff-${randomUUID().slice(0, 12)}`;
  await makeStaff(`test:${user}`, role);
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': ownAddress() });
  await signIn(page, user);
  return `test:${user}`;
}

/**
 * Gets into the reviewers' pages the way staff do: signed in to the site with
 * an account that holds a role, then a code from an authenticator, which a
 * new account sets up first. Each call is a new account from a made-up
 * network address of its own, so the tests do not use up each other's tries.
 * Returns the account's id and its authenticator key.
 */
export async function signInAsReviewer(
  page: Page,
  next = '/admin/content',
  role: 'admin' | 'reviewer' = 'admin',
): Promise<{ userId: string; key: string }> {
  const userId = await signInAsStaffAccount(page, role);
  await page.goto(next);
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  const key = await setupKey(page);
  await page.getByLabel('Six-digit code').fill(authenticatorCode(key));
  await page.getByRole('button', { name: 'Turn it on and continue' }).click();
  // The development server compiles the page asked for the first time it is opened.
  await expect(page).not.toHaveURL(/\/admin\/sign-in/, { timeout: 120_000 });
  return { userId, key };
}
