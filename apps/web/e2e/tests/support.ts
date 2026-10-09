import { randomUUID } from 'node:crypto';

import AxeBuilder from '@axe-core/playwright';
import { translatorFor } from '@oathly/i18n/messages';
import { expect, type Page } from '@playwright/test';

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

/**
 * Signs in to the reviewers' pages through their own sign-in form. Each call
 * comes from a made-up network address of its own: tries at the password are
 * limited per address, and the tests must not use up each other's.
 */
export async function signInAsReviewer(page: Page, next = '/admin/content'): Promise<void> {
  const address = `192.0.2.${1 + Math.floor(Math.random() * 250)}, 10.1.${Math.floor(Math.random() * 250)}.1`;
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': address });
  await page.goto(next);
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  await page.getByLabel('Username').fill(process.env.E2E_ADMIN_USERNAME!);
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/admin\/sign-in/);
}
