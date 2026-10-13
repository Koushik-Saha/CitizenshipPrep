import { expect, test } from '@playwright/test';

import { addQuestionsToReview, auditTrail } from '../database';
import {
  authenticatorCode,
  expectAccessible,
  expectAccessibleInBothThemes,
  ownAddress,
  scanSetupCode,
  setupKey,
  signInAsReviewer,
  signInAsStaffAccount,
} from './support';

// The reviewers' pages: getting in with an authenticator, the review queue with its filters,
// and deciding several questions at once. Global setup puts four Testland
// questions in the queue ("Testland question 91" to 94) for looking at; the
// test that decides questions adds its own, so it can be run again.

/** A notice of ours, not the framework's page-change announcer, which is an alert too. */
const alert = (page: import('@playwright/test').Page, text: string | RegExp) =>
  page.getByRole('alert').filter({ hasText: text });

test('the review pages ask staff for a code from their authenticator, and take no wrong one', async ({
  page,
  request,
}) => {
  const direct = await request.get('/admin/content?view=translations', { maxRedirects: 0 });
  expect(direct.status()).toBe(307);
  expect(direct.headers().location).toContain('/admin/sign-in?next=');

  // A member of staff, signed in to the site with their own account.
  const userId = await signInAsStaffAccount(page);
  await page.goto('/admin/content?view=translations');
  await expect(page).toHaveURL(/\/admin\/sign-in\?next=/);
  // Their first time: an authenticator to set up.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Set up your authenticator');
  await expectAccessibleInBothThemes(page, 'authenticator set-up');
  // A QR code to scan, which says what an authenticator needs: who issues the
  // codes, for which account, and the key.
  await expect(page.getByTestId('totp-qr')).toBeVisible();
  const scanned = new URL((await scanSetupCode(page))!);
  expect(scanned.protocol).toBe('otpauth:');
  expect(scanned.host).toBe('totp');
  expect(decodeURIComponent(scanned.pathname)).toMatch(/^\/Oathly:/);
  expect(scanned.searchParams.get('issuer')).toBe('Oathly');
  expect(scanned.searchParams.get('digits')).toBe('6');
  expect(scanned.searchParams.get('period')).toBe('30');
  // For a phone that cannot scan, the same key can be typed instead.
  const key = await setupKey(page);
  expect(key.replace(/\s/g, '')).toBe(scanned.searchParams.get('secret'));
  await expect(page.getByTestId('totp-secret')).toBeHidden();
  await page.getByText('Cannot scan it? Enter the key instead').click();
  await expect(page.getByTestId('totp-secret')).toBeVisible();
  // The key stays the same until it is in use: a reload does not undo the phone.
  await page.reload();
  expect(await setupKey(page)).toBe(key);
  // A code made from what was scanned is what gets in, below.

  await page.getByLabel('Six-digit code').fill('000000');
  await page.getByRole('button', { name: 'Turn it on and continue' }).click();
  await expect(alert(page, 'That code is not right')).toBeVisible();
  await expectAccessible(page, 'authenticator set-up, refused');
  // Still outside.
  expect((await page.request.get('/admin/content', { maxRedirects: 0 })).status()).toBe(307);

  // The right one goes on to the page that was asked for.
  const firstCode = authenticatorCode(key);
  await page.getByLabel('Six-digit code').fill(firstCode);
  await page.getByRole('button', { name: 'Turn it on and continue' }).click();
  await expect(page).toHaveURL(/\/admin\/content\?view=translations$/);
  await expect(page.getByText('Signed in as')).toBeVisible();

  // Signing out of the reviewers' area leaves the account signed in to the site.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  await expect(page.getByRole('status').filter({ hasText: 'You are signed out' })).toBeVisible();
  await page.goto('/admin/content');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  // The authenticator is in use now: its key is never shown again.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Enter your code');
  await expect(page.getByTestId('totp-secret')).toHaveCount(0);
  await expectAccessible(page, 'reviewer sign-in, code');

  // A code works once: the one that turned the authenticator on is spent.
  await page.getByLabel('Six-digit code').fill(firstCode);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(alert(page, 'already been used')).toBeVisible();
  // The next one is good.
  await page.getByLabel('Six-digit code').fill(authenticatorCode(key, 1));
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/admin\/content$/);

  // All of it is on the record, in order, under their own account.
  expect(await auditTrail(userId)).toEqual([
    'second-factor.refused',
    'second-factor.enrolled',
    'sign-in.accepted',
    'sign-out',
    'sign-in.refused',
    'sign-in.accepted',
  ]);
});

test('tries at the code are limited, for the account and for the network address', async ({
  page,
}) => {
  test.slow();
  const { key } = await signInAsReviewer(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Enter your code');

  const guess = async (code: string) => {
    await page.getByLabel('Six-digit code').fill(code);
    // The answer to one guess looks like the answer to the last: wait for this one's.
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' && response.url().includes('/admin/sign-in'),
      ),
      page.getByRole('button', { name: 'Continue' }).click(),
    ]);
    await expect(page.getByRole('alert').filter({ hasText: /not right|Too many/ })).toBeVisible();
    await expect(page.getByLabel('Six-digit code')).toHaveValue('');
    return alert(page, 'Too many tries').isVisible();
  };

  // Five tries in a quarter of an hour, and setting the authenticator up was the first.
  let refusedAt = 0;
  for (let i = 1; i <= 8 && !refusedAt; i += 1) {
    if (await guess(String(100000 + i))) refusedAt = i;
  }
  expect(refusedAt).toBe(5);
  // Even the right code waits now.
  expect(await guess(authenticatorCode(key, 1))).toBe(true);
  // Coming from somewhere else does not help: the account itself is being counted.
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': ownAddress() });
  expect(await guess(authenticatorCode(key, 1))).toBe(true);
  expect((await page.request.get('/admin/content', { maxRedirects: 0 })).status()).toBe(307);
});

test('an address that keeps trying is stopped, whichever account it tries', async ({ browser }) => {
  test.slow();
  // An address of its own, from a range no other test signs in from.
  const address = `198.18.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}, 10.8.0.8`;
  let refused = false;
  // Three accounts, two wrong codes each: six tries from one address.
  for (let account = 1; account <= 3; account += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInAsStaffAccount(page);
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': address });
    await page.goto('/admin/content');
    for (let guessed = 1; guessed <= 2; guessed += 1) {
      await page.getByLabel('Six-digit code').fill('000000');
      // The answer to one guess looks like the answer to the last: wait for this one's.
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' && response.url().includes('/admin/sign-in'),
        ),
        page.getByRole('button', { name: 'Turn it on and continue' }).click(),
      ]);
      await expect(page.getByRole('alert').filter({ hasText: /not right|Too many/ })).toBeVisible();
      await expect(page.getByLabel('Six-digit code')).toHaveValue('');
      refused = await alert(page, 'Too many tries').isVisible();
      // Nobody was refused before the sixth try.
      expect(refused, `account ${account}, try ${guessed}`).toBe(account === 3 && guessed === 2);
    }
    await context.close();
  }
  expect(refused).toBe(true);
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

test('a long queue is paged, and the filters keep their place', async ({ page }) => {
  test.slow();
  // Thirty of this test's own, found by a tag nothing else has.
  const tag = `paged ${Math.random().toString(36).slice(2, 8)}`;
  await addQuestionsToReview(
    Array.from({ length: 30 }, (_, i) => 101 + i),
    tag,
  );
  await signInAsReviewer(
    page,
    `/admin/content?view=questions&country=ZZ&per=25&q=${encodeURIComponent(tag)}`,
  );
  const summary = page.getByTestId('page-summary');
  await expect(summary).toHaveText('1 to 25 of 30 questions');
  await expect(page.locator('input[name="ids"]')).toHaveCount(25);
  const pages = page.getByRole('navigation', { name: 'Pages' });
  await expect(pages.locator('[aria-current="page"]')).toHaveText('Page 1');
  await expectAccessibleInBothThemes(page, 'review queue, paged');

  await pages.getByRole('link', { name: 'Next' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(summary).toHaveText('26 to 30 of 30 questions');
  await expect(page.locator('input[name="ids"]')).toHaveCount(5);
  // The search and the page size came along.
  await expect(page).toHaveURL(/per=25/);
  await expect(page.getByLabel('Search questions')).toHaveValue(tag);

  // Changing a filter starts again from the first page.
  await page.getByLabel('Order').selectOption({ label: 'Newest first' });
  await expect(page).toHaveURL(/sort=newest/);
  await expect(page).not.toHaveURL(/page=2/);
  await expect(summary).toHaveText('1 to 25 of 30 questions');

  // These were drafted in the test, not loaded from a file: none is an official question.
  const origin = page.getByLabel('Where the wording comes from');
  await origin.selectOption({ label: 'Official questions' });
  await expect(page.getByText('Nothing matches these filters.')).toBeVisible();
  // Taking the filter off by its chip resets its menu too, so the next change does not bring it back.
  await page.getByRole('link', { name: /Official questions/ }).click();
  await expect(page).not.toHaveURL(/origin=/);
  await expect(origin).toHaveValue('');
  await page.getByLabel('Kind of question').selectOption({ label: 'Multiple choice' });
  await expect(page).toHaveURL(/type=multiple_choice/);
  await page.getByLabel('Difficulty').selectOption({ label: 'Easy (1 to 2)' });
  await expect(page).toHaveURL(/level=easy/);
  await expect(page).not.toHaveURL(/origin=/);
  await expect(summary).toHaveText('1 to 25 of 30 questions');

  // A page past the end shows the last one.
  await page.goto(
    `/admin/content?view=questions&country=ZZ&per=25&page=99&q=${encodeURIComponent(tag)}`,
  );
  await expect(summary).toHaveText('26 to 30 of 30 questions');
});

test('a reviewer works through a filter from the question page, with the keyboard', async ({
  page,
}) => {
  test.slow();
  // Three of this test's own, citing words that are in the Testland guide.
  const tag = `keys ${Math.random().toString(36).slice(2, 8)}`;
  await addQuestionsToReview([81, 82, 83], tag, {
    quote: 'the assembly chooses the First Minister',
  });
  await signInAsReviewer(
    page,
    `/admin/content?view=questions&country=ZZ&q=${encodeURIComponent(tag)}`,
  );
  // Other tests approve as the same reviewer while this one runs, so the
  // count is only ever checked to have gone up.
  const approved = async () => {
    await expect(page.getByTestId('approved-today')).toHaveText(/^\d+ approved today$/);
    return Number((await page.getByTestId('approved-today').innerText()).split(' ')[0]);
  };
  const approvedBefore = await approved();

  await page.getByRole('link', { name: /Testland question 81/ }).click();
  // The development server builds this page the first time it is asked for.
  await page.waitForURL(/\/admin\/content\/questions\/[0-9a-f-]{36}\?/, { timeout: 120_000 });
  // The filter came along, and says where this question stands in it.
  await expect(page).toHaveURL(new RegExp(`q=${tag.replace(' ', '\\+')}`));
  const place = page.getByTestId('queue-place');
  await expect(place).toHaveText('1 of 3');

  // The whole passage the quote comes from, with the quoted words marked in it.
  const passage = page.getByRole('region', { name: 'Source passage' });
  await expect(passage).toContainText('has 40 members elected every four years');
  await expect(passage).toContainText('Sums used in the test');
  await expect(passage.locator('mark#cited')).toHaveText('The Assembly chooses the First Minister');
  await expect(page.getByText('This one was found by its quoted words.')).toBeVisible();
  await expect(page.getByText('Testland guide, the chapter on government')).toBeVisible();
  await expectAccessibleInBothThemes(page, 'review question, in a filter');

  const question = page.getByLabel('Question (en)');
  // J and K move through the filter without going back to the list.
  await page.keyboard.press('j');
  await expect(place).toHaveText('2 of 3');
  await expect(question).toHaveValue(/Testland question 82/);
  await page.keyboard.press('k');
  await expect(place).toHaveText('1 of 3');
  await expect(question).toHaveValue(/Testland question 81/);
  await expect(page.getByRole('link', { name: 'Previous' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Next' }).click();
  await expect(place).toHaveText('2 of 3');
  await page.getByRole('link', { name: 'Previous' }).click();
  await expect(place).toHaveText('1 of 3');

  // A letter typed into a field is a letter, not a decision.
  await question.focus();
  await page.keyboard.type(' a j r ');
  await expect(place).toHaveText('1 of 3');
  await expect(question).toHaveValue(/ a j r /);
  await expect(question).toHaveValue(/Testland question 81/);

  // S saves, and stays on the question and in the filter.
  await question.blur();
  await page.keyboard.press('s');
  await expect(page.getByRole('status').filter({ hasText: 'Changes saved.' })).toBeVisible();
  await expect(place).toHaveText('1 of 3');

  // With the keys switched off, a letter does nothing.
  await page.getByLabel('Keyboard shortcuts').uncheck();
  await expect(page.getByTestId('shortcut-keys')).toHaveCount(0);
  await page.locator('h1').click();
  await page.keyboard.press('a');
  await page.keyboard.press('j');
  await expect(place).toHaveText('1 of 3');
  await page.getByLabel('Keyboard shortcuts').check();

  // A approves and goes straight to the next one.
  await page.locator('h1').click();
  await page.keyboard.press('a');
  await expect(
    page.getByRole('status').filter({ hasText: 'Approved and published. This is the next one.' }),
  ).toBeVisible();
  await expect(question).toHaveValue(/Testland question 82/);
  await expect(place).toHaveText('1 of 2');
  expect(await approved()).toBeGreaterThanOrEqual(approvedBefore + 1);

  // R goes to the reason; Ctrl+Enter sends it.
  await page.locator('h1').click();
  await page.keyboard.press('r');
  await expect(page.getByLabel('Reason')).toBeFocused();
  await page.keyboard.type('Not what the guide says.');
  await page.keyboard.press('Control+Enter');
  await expect(
    page.getByRole('status').filter({ hasText: 'Rejected. This is the next one.' }),
  ).toBeVisible();
  await expect(question).toHaveValue(/Testland question 83/);
  await expect(place).toHaveText('1 of 1');

  // The last one in the filter leads back to the queue, still filtered.
  await page.getByRole('button', { name: 'Approve and publish' }).click();
  await expect(page).toHaveURL(/\/admin\/content\?/);
  await expect(page).toHaveURL(/country=ZZ/);
  await expect(
    page.getByRole('status').filter({ hasText: 'Approved and published.' }),
  ).toBeVisible();
  await expect(page.getByText('Nothing matches these filters.')).toBeVisible();
  expect(await approved()).toBeGreaterThanOrEqual(approvedBefore + 2);
});

test('a question whose source is not loaded shows its quote and says so', async ({ page }) => {
  test.slow();
  const tag = `bare ${Math.random().toString(36).slice(2, 8)}`;
  await addQuestionsToReview([84], tag, { quote: 'words that are in no loaded passage' });
  await signInAsReviewer(
    page,
    `/admin/content?view=questions&country=ZZ&q=${encodeURIComponent(tag)}`,
  );
  await page.getByRole('link', { name: /Testland question 84/ }).click();
  await page.waitForURL(/\/admin\/content\/questions\//, { timeout: 120_000 });
  await expect(page.getByText('“words that are in no loaded passage”')).toBeVisible();
  await expect(page.getByTestId('no-passage')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Source passage' })).toHaveCount(0);
  await expectAccessible(page, 'review question, source not loaded');
});

test('several questions are approved or rejected at once', async ({ page }) => {
  // Four of this test's own, found by a tag nothing else has. One of them
  // says nothing of where its answer is in the source.
  const tag = `set ${Math.random().toString(36).slice(2, 8)}`;
  await addQuestionsToReview([95, 96, 98], tag);
  await addQuestionsToReview([97], tag, { source: 'none' });
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

  // Approving asks first, saying how many will be published.
  const dialog = page.getByRole('dialog');
  await bar.getByRole('button', { name: 'Approve and publish' }).click();
  await expect(dialog.getByRole('heading')).toHaveText('Approve 2 questions?');
  await expect(dialog.getByTestId('confirm-count')).toHaveText(
    '2 questions will be published and shown to learners as soon as you confirm.',
  );
  await expectAccessible(page, 'review queue, confirming an approval');
  // Cancelling publishes nothing.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(boxes).toHaveCount(4);

  // An approval that did not come through the dialog is refused by the server.
  await page.evaluate(() => {
    const form = document.querySelector<HTMLInputElement>('input[name="ids"]')!.form!;
    const promise = document.createElement('input');
    promise.type = 'hidden';
    promise.name = 'checked';
    promise.value = 'on';
    const button = document.createElement('button');
    button.name = 'decision';
    button.value = 'approve';
    button.hidden = true;
    form.append(promise, button);
    form.requestSubmit(button);
  });
  await expect(alert(page, /Confirm how many you are approving/)).toBeVisible();
  await expect(boxes).toHaveCount(4);

  // With one that has no source among them: it is named, and left out.
  await page.getByLabel(/Select: Testland question 95/).check();
  await page.getByLabel(/Select: Testland question 96/).check();
  await page.getByLabel(/Select: Testland question 97/).check();
  await bar.getByRole('button', { name: 'Approve and publish' }).click();
  await expect(dialog.getByRole('heading')).toHaveText('Approve 2 questions?');
  await expect(dialog.getByTestId('confirm-refused')).toContainText(
    '1 question has no source to check against and will not be approved here.',
  );
  // Publishing in bulk is still the reviewer saying each was checked.
  const confirm = dialog.getByRole('button', { name: 'Approve 2 questions' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('I have checked each of them against its source.').check();
  await confirm.click();
  await expect(
    page.getByRole('status').filter({ hasText: '2 approved and published.' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: '1 could not be: It has no source to check it against.' }),
  ).toBeVisible();
  await expect(boxes).toHaveCount(2);
  // Still on the filtered queue they were working through.
  await expect(page).toHaveURL(/country=ZZ/);
  await expect(page.getByRole('link', { name: /Testland question 97/ })).toBeVisible();

  // Only ones with no source: there is nothing to approve together.
  await page.getByLabel(/Select: Testland question 97/).check();
  await bar.getByRole('button', { name: 'Approve and publish' }).click();
  await expect(dialog.getByRole('heading')).toHaveText('Nothing to approve');
  await expect(dialog.getByRole('button', { name: /^Approve/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancel' }).click();

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
