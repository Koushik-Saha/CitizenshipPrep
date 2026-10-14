import { expect, test, type Page } from '@playwright/test';

import { signInAndOnboard, signInAsReviewer } from './support';

// Everything that can be clicked shows the hand, and what cannot be clicked
// right now shows that it cannot. Tailwind 4 leaves buttons with the arrow,
// so this is set once in globals.css; these pages hold every kind of control
// the site has, signed out, as a learner and as an admin.

// Several pages each: the development server compiles each one the first
// time it is opened, which can take longer than one test is usually given.
test.slow();

const CONTROLS = [
  'button',
  '[role="button"]',
  'summary',
  'select',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
].join(', ');

/** Controls on the page whose cursor is not the one they should have. */
async function wrongCursors(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const describe = (element: Element) =>
      `${element.tagName.toLowerCase()} "${(
        element.textContent?.trim() ||
        element.getAttribute('aria-label') ||
        ''
      ).slice(0, 40)}"`;
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((element) => element.getClientRects().length > 0)
      .flatMap((element) => {
        const disabled =
          (element as HTMLButtonElement).disabled === true ||
          element.getAttribute('aria-disabled') === 'true';
        const expected = disabled ? 'not-allowed' : 'pointer';
        const cursor = getComputedStyle(element).cursor;
        return cursor === expected ? [] : [`${describe(element)}: ${cursor}, not ${expected}`];
      });
  }, CONTROLS);
}

async function expectHandCursors(page: Page, paths: string[]) {
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(await wrongCursors(page), path).toEqual([]);
  }
}

test('buttons and other controls show the hand on the public pages', async ({ page }) => {
  await expectHandCursors(page, ['/', '/countries', '/sign-in', '/contact', '/es']);
});

test('buttons and other controls show the hand on the study pages', async ({ page }) => {
  await signInAndOnboard(page);
  await expectHandCursors(page, [
    '/study',
    '/study/account',
    '/study/plans',
    '/study/tutor/zz',
    '/study/community',
  ]);
});

test('buttons and other controls show the hand in the admin area', async ({ page }) => {
  await signInAsReviewer(page, '/admin/content');
  await expectHandCursors(page, [
    '/admin/content',
    '/admin/content?view=published',
    '/admin/flags',
  ]);
  // A ticked box brings up the bulk bar's buttons; they show the hand too.
  await page.goto('/admin/content');
  const box = page.locator('input[name="ids"]').first();
  if ((await box.count()) > 0) {
    await box.check();
    await expect(page.getByTestId('bulk-bar')).toBeVisible();
    expect(await wrongCursors(page), 'bulk bar').toEqual([]);
  }
});
