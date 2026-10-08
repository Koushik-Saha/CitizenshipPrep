import { expect, test } from '@playwright/test';

import { expectAccessibleInBothThemes } from './support';

// The reviewers' pages, behind their own sign-in, and the internal brand page.

test('the review pages ask for a password', async ({ request }) => {
  const response = await request.get('/admin/content');
  expect(response.status()).toBe(401);
  expect(response.headers()['www-authenticate']).toContain('Basic');
});

test('the review pages are accessible', async ({ browser }) => {
  const context = await browser.newContext({
    httpCredentials: {
      username: process.env.E2E_ADMIN_USERNAME!,
      password: process.env.E2E_ADMIN_PASSWORD!,
    },
  });
  const page = await context.newPage();
  for (const [path, name] of [
    ['/admin', 'admin home'],
    ['/admin/content', 'content review'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessibleInBothThemes(page, name);
  }
  await context.close();
});

test('the brand page is accessible', async ({ page }) => {
  await page.goto('/brand');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectAccessibleInBothThemes(page, 'brand');
});
