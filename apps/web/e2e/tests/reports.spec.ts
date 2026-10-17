import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { auditTrail } from '../database';
import {
  expectAccessible,
  expectAccessibleInBothThemes,
  signInAndOnboard,
  signInAsReviewer,
  t,
} from './support';

// A learner says something is wrong with a question; a reviewer finds the
// report in their queue with the question beside it, and closes it. And the
// contact page, which anyone can reach from the footer.

test('a learner reports a question, and a reviewer answers the report', async ({
  page,
  browser,
}) => {
  test.slow();
  const note = `The second option is misspelled (${randomUUID().slice(0, 8)})`;
  const second = `This changed last year (${randomUUID().slice(0, 8)})`;

  await signInAndOnboard(page);
  await page.getByRole('button', { name: t('dashboard.practise'), exact: true }).click();
  await expect(page).toHaveURL(/\/study\/session\/[0-9a-f-]{36}$/);

  // With the question still unanswered: the control is on every question.
  await page.getByRole('button', { name: t('report.open') }).click();
  await expectAccessibleInBothThemes(page, 'report a question');
  // Nothing is sent without saying what is wrong.
  await expect(page.getByRole('button', { name: t('report.send') })).toBeDisabled();
  await page.getByRole('radio', { name: t('report.typo') }).check();
  await page.getByLabel(t('report.details')).fill(note);
  const sent = page.waitForResponse((response) => response.url().endsWith('/report'));
  await page.getByRole('button', { name: t('report.send') }).click();
  expect((await sent).status()).toBe(201);
  await expect(page.getByRole('status').filter({ hasText: t('report.thanks') })).toBeVisible();

  // The same learner reports the same question again, for another reason.
  const questionUrl = (await sent).url();
  const again = await page.request.post(questionUrl, {
    data: { reason: 'outdated', details: second },
  });
  expect(again.status()).toBe(201);
  // The same thing twice adds nothing, and is not an error.
  expect((await page.request.post(questionUrl, { data: { reason: 'outdated' } })).status()).toBe(
    200,
  );
  // A reason that is not offered, and a question that is not theirs to report.
  expect((await page.request.post(questionUrl, { data: { reason: 'other' } })).status()).toBe(400);
  expect(
    (
      await page.request.post('/api/questions/00000000-0000-4000-8000-000000000000/report', {
        data: { reason: 'typo' },
      })
    ).status(),
  ).toBe(404);

  // The reviewers' queue has both, each with the question and its marked answer.
  const reviewer = await (await browser.newContext()).newPage();
  const { userId } = await signInAsReviewer(reviewer, '/admin/flags');
  await expect(reviewer.getByRole('heading', { level: 1 })).toHaveText('Reports from learners');
  await expect(reviewer.getByRole('link', { name: /^Reports \(\d+\)$/ })).toBeVisible();
  const typo = reviewer.getByTestId('flag-item').filter({ hasText: note });
  await expect(typo).toContainText('Typo');
  await expect(typo).toContainText('Testland question');
  await expect(typo).toContainText('(marked correct)');
  await expect(typo).toContainText('2 open reports on this question');
  await expect(typo.getByRole('link', { name: 'Open the question to fix it' })).toHaveAttribute(
    'href',
    /\/admin\/content\/questions\/[0-9a-f-]{36}$/,
  );
  await expectAccessibleInBothThemes(reviewer, 'reports queue');

  // Nothing wrong with the first: dismissed, with a note.
  await typo.getByLabel(/Note/).fill('The spelling is the guide’s own.');
  await typo.getByRole('button', { name: 'Dismiss' }).click();
  await expect(reviewer.getByRole('status').filter({ hasText: 'Dismissed.' })).toBeVisible();
  await expect(reviewer.getByTestId('flag-item').filter({ hasText: note })).toHaveCount(0);

  // The second was right, and has been dealt with.
  const outdated = reviewer.getByTestId('flag-item').filter({ hasText: second });
  await expect(outdated).toContainText('Out of date');
  await outdated.getByRole('button', { name: 'Mark fixed' }).click();
  await expect(reviewer.getByRole('status').filter({ hasText: 'Marked as fixed.' })).toBeVisible();
  await expect(reviewer.getByTestId('flag-item').filter({ hasText: second })).toHaveCount(0);

  // Both decisions are on the record under the reviewer's own account.
  expect(await auditTrail(userId)).toEqual(expect.arrayContaining(['flag.dismiss', 'flag.fixed']));
});

test('someone signed out cannot report a question', async ({ request }) => {
  const response = await request.post(
    '/api/questions/00000000-0000-4000-8000-000000000000/report',
    { data: { reason: 'typo' } },
  );
  expect(response.status()).toBe(401);
});

test('the contact page is reached from the footer, in the reader’s language', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('contentinfo')
    .getByRole('link', { name: t('common.contact') })
    .click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('contact.title'));
  await expect(page.getByText(t('contact.notAdvice'))).toBeVisible();
  // This server sends no email, so there is no form, and nothing says there is one.
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(
    page.getByText(t('contact.direct', { email: '' }).replace(/\s*\.$/, '')),
  ).toHaveCount(0);
  const address = page.getByTestId('contact-address');
  if (await address.count()) {
    await expect(address).toHaveText(/^Email us at \S+@\S+\.$/);
    await expect(address.getByRole('link')).toHaveAttribute('href', /^mailto:\S+@\S+$/);
  } else {
    await expect(page.getByText(t('contact.unavailable'))).toBeVisible();
  }
  await expectAccessibleInBothThemes(page, 'contact');

  await page.goto('/es/contact');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contacto');
  await expectAccessible(page, 'contact, Spanish');
});
