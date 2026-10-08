import { expect, test } from '@playwright/test';

import { addQuestionsToReview } from '../database';
import { expectAccessible, expectAccessibleInBothThemes, signInAsReviewer } from './support';

// The reviewers' pages: their own sign-in, the review queue with its filters,
// and deciding several questions at once. Global setup puts four Testland
// questions in the queue ("Testland question 91" to 94) for looking at; the
// test that decides questions adds its own, so it can be run again.

/** A notice of ours, not the framework's page-change announcer, which is an alert too. */
const alert = (page: import('@playwright/test').Page, text: string | RegExp) =>
  page.getByRole('alert').filter({ hasText: text });

test('the review pages lead to their sign-in, which lets nobody in on a wrong password', async ({
  page,
  request,
}) => {
  const direct = await request.get('/admin/content?view=translations', { maxRedirects: 0 });
  expect(direct.status()).toBe(307);
  expect(direct.headers().location).toContain('/admin/sign-in?next=');

  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': '192.0.2.251, 10.9.9.9' });
  await page.goto('/admin/content?view=translations');
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Content review');
  await expectAccessibleInBothThemes(page, 'reviewer sign-in');

  await page.getByLabel('Username').fill(process.env.E2E_ADMIN_USERNAME!);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(alert(page, 'That username or password is not right.')).toBeVisible();
  await expectAccessible(page, 'reviewer sign-in, refused');
  // Still outside.
  expect((await page.request.get('/admin/content', { maxRedirects: 0 })).status()).toBe(307);

  // The right one goes on to the page that was asked for.
  await page.getByLabel('Username').fill(process.env.E2E_ADMIN_USERNAME!);
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/content\?view=translations$/);
  await expect(page.getByText(`Signed in as ${process.env.E2E_ADMIN_USERNAME}`)).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  await expect(page.getByRole('status').filter({ hasText: 'You are signed out.' })).toBeVisible();
  await page.goto('/admin/content');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
});

test('guesses at the reviewers’ password are limited', async ({ page }) => {
  test.slow();
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `192.0.2.${1 + Math.floor(Math.random() * 250)}, 10.8.${Math.floor(Math.random() * 250)}.8`,
  });
  await page.goto('/admin/sign-in');
  let refusedAt = 0;
  for (let i = 1; i <= 24 && !refusedAt; i += 1) {
    await page.getByLabel('Username').fill('reviewer');
    await page.getByLabel('Password').fill(`guess-number-${i}`);
    // The answer to one guess looks like the answer to the last: wait for this one's.
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' && response.url().includes('/admin/sign-in'),
      ),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ]);
    await expect(page.getByRole('alert').filter({ hasText: /not right|Too many/ })).toBeVisible();
    await expect(page.getByLabel('Password')).toHaveValue('');
    if (await alert(page, 'Too many tries').isVisible()) refusedAt = i;
  }
  // Ten in a quarter of an hour, then no more: even the right password would wait.
  expect(refusedAt).toBeGreaterThanOrEqual(11);
});

test('the queue narrows by country, words and topic', async ({ page }) => {
  await signInAsReviewer(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review queue');

  await page.getByLabel('Country').selectOption({ label: 'Testland' });
  await expect(page).toHaveURL(/country=ZZ/);
  await expect(page.getByRole('link', { name: /Testland question 91/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Testland question 94/ })).toBeVisible();
  await expectAccessibleInBothThemes(page, 'review queue');

  await page.getByLabel('Search questions').fill('question 92');
  await expect(page).toHaveURL(/q=question\+92/);
  await expect(page.locator('input[name="ids"]')).toHaveCount(1);
  await expect(page.getByRole('link', { name: /Testland question 92/ })).toBeVisible();

  // Each filter in use can be taken off on its own.
  await page.getByRole('link', { name: /“question 92”/ }).click();
  await expect(page.getByRole('link', { name: /Testland question 93/ })).toBeVisible();
  await page.getByLabel('Topic').selectOption({ label: 'History' });
  await expect(page.getByText('Nothing matches these filters.')).toBeVisible();
  await page.getByRole('link', { name: 'Clear all' }).click();
  await expect(page).toHaveURL(/\/admin\/content\?view=questions$/);
});

test('several questions are approved or rejected at once', async ({ page }) => {
  // Four of this test's own, found by a tag nothing else has.
  const tag = `set ${Math.random().toString(36).slice(2, 8)}`;
  await addQuestionsToReview([95, 96, 97, 98], tag);
  await signInAsReviewer(
    page,
    `/admin/content?view=questions&country=ZZ&q=${encodeURIComponent(tag)}`,
  );
  const boxes = page.locator('input[name="ids"]');
  await expect(boxes).toHaveCount(4);
  const bar = page.getByTestId('bulk-bar');
  await expect(bar).toBeHidden();

  await page.getByLabel(/Select: Testland question 95/).check();
  await page.getByLabel(/Select: Testland question 96/).check();
  await expect(page.getByText('2 questions selected')).toBeVisible();
  await expect(bar).toBeVisible();
  await expectAccessibleInBothThemes(page, 'review queue, two selected');

  // Publishing in bulk is still the reviewer saying each was checked.
  await bar.getByRole('button', { name: 'Approve and publish' }).click();
  await expect(alert(page, /confirm you have checked each one/)).toBeVisible();
  await expect(boxes).toHaveCount(4);

  await page.getByLabel(/Select: Testland question 95/).check();
  await page.getByLabel(/Select: Testland question 96/).check();
  await bar.getByLabel('I have checked each selected question against its source.').check();
  await bar.getByRole('button', { name: 'Approve and publish' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '2 approved and published.' }),
  ).toBeVisible();
  await expect(boxes).toHaveCount(2);
  // Still on the filtered queue they were working through.
  await expect(page).toHaveURL(/country=ZZ/);
  await expect(page.getByRole('link', { name: /Testland question 97/ })).toBeVisible();

  // The rest, all at once, need a reason to be rejected.
  await page.getByLabel('Select all 2').check();
  await expect(page.getByText('2 questions selected')).toBeVisible();
  await bar.getByRole('button', { name: 'Reject' }).click();
  await expect(alert(page, 'Say why they are rejected.')).toBeVisible();
  await page.getByLabel('Select all 2').check();
  await bar.getByLabel('Reason, if rejecting').fill('Not in the guide.');
  await bar.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByRole('status').filter({ hasText: '2 rejected.' })).toBeVisible();
  await expect(page.getByText('Nothing matches these filters.')).toBeVisible();
});

test('the brand page is accessible', async ({ page }) => {
  await page.goto('/brand');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/.+/);
  await expectAccessibleInBothThemes(page, 'brand');
});
