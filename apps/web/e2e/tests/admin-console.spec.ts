import { expect, test } from '@playwright/test';

import { auditTrail, sql } from '../database';
import {
  expectAccessibleInBothThemes,
  newLearner,
  signInAndOnboard,
  signInAsReviewer,
} from './support';

// The admin's own pages: finding a user, what people hold and pay for, the
// organizations, and what the AI is costing. Each is for admins only (see
// security/admin-access.spec.ts for who is kept out).

test('an admin finds a user, sees what they hold and do, and deletes the account on request', async ({
  page,
  browser,
}) => {
  test.slow();
  // A learner with a plan and some AI use to show.
  const learnerPage = await (await browser.newContext()).newPage();
  const name = newLearner();
  await signInAndOnboard(learnerPage, { user: name });
  const learner = `test:${name}`;
  await sql(
    `insert into public.subscriptions
       (user_id, plan, status, provider, provider_subscription_id, current_period_end)
     values ($1, 'pro_monthly', 'active', 'manual', $2, now() + interval '20 days')`,
    [learner, `e2e-${name}`],
  );

  const { userId: admin } = await signInAsReviewer(page, '/admin/users');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Users');
  await expectAccessibleInBothThemes(page, 'admin users');

  await page.getByLabel('Search').fill(learner);
  await page.getByRole('button', { name: 'Search' }).click();
  const row = page.getByTestId('user-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Pro');
  await expect(row).toContainText('ZZ');

  await row.getByRole('link').first().click();
  await expect(page).toHaveURL(/\/admin\/users\/test/);
  await expect(page.getByText(learner, { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'pro_monthly' })).toBeVisible();
  await expect(page.getByText('0 of 200')).toBeVisible();
  await expectAccessibleInBothThemes(page, 'admin user');
  // Looking at someone's account is recorded.
  expect(await auditTrail(admin)).toContain('user.view');

  // Deleting takes the word and a reason.
  await page.getByLabel('Who asked, and how').fill('Asked by email on 13 October.');
  await page.getByLabel('Type DELETE to confirm').fill('delete please');
  await page.getByRole('button', { name: 'Delete the account' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Type DELETE' })).toBeVisible();
  expect(await sql('select 1 from public.profiles where id = $1', [learner])).toHaveLength(1);

  await page.getByLabel('Who asked, and how').fill('Asked by email on 13 October.');
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button', { name: 'Delete the account' }).click();
  await expect(page).toHaveURL(/\/admin\/users\?deleted=/);
  await expect(page.getByRole('status').filter({ hasText: 'have been deleted' })).toBeVisible();
  // Gone, with everything of theirs; and it is on the record, with the reason.
  expect(await sql('select 1 from public.profiles where id = $1', [learner])).toHaveLength(0);
  expect(
    await sql('select 1 from public.subscriptions where user_id = $1', [learner]),
  ).toHaveLength(0);
  const [entry] = await sql<{ detail: { reason: string } }>(
    `select detail from public.admin_audit_log
     where actor_id = $1 and action = 'user.delete' and target_id = $2`,
    [admin, learner],
  );
  expect(entry!.detail.reason).toBe('Asked by email on 13 October.');

  // An admin cannot delete the account they are signed in with.
  await page.goto(`/admin/users/${encodeURIComponent(admin)}`);
  await page.getByLabel('Who asked, and how').fill('Testing that it is refused.');
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button', { name: 'Delete the account' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'signed in with' })).toBeVisible();
  expect(await sql('select 1 from public.profiles where id = $1', [admin])).toHaveLength(1);
});

test('an admin sees subscriptions, organizations and what the AI is costing', async ({
  page,
  browser,
}) => {
  test.slow();
  const learnerPage = await (await browser.newContext()).newPage();
  const name = newLearner();
  await signInAndOnboard(learnerPage, { user: name });
  const learner = `test:${name}`;
  await sql(`update public.profiles set display_name = $2 where id = $1`, [learner, `Ada ${name}`]);
  await sql(
    `insert into public.subscriptions
       (user_id, plan, status, provider, provider_subscription_id, current_period_end,
        cancel_at_period_end)
     values ($1, 'pro_yearly', 'past_due', 'stripe', $2, now() + interval '5 days', true)`,
    [learner, `sub_e2e${name.replace(/[^a-z0-9]/g, '')}`],
  );
  // A learner on Free who has used all twenty of the day's explanations.
  const heavyPage = await (await browser.newContext()).newPage();
  const heavyName = newLearner();
  await signInAndOnboard(heavyPage, { user: heavyName });
  await sql(
    `insert into public.ai_usage (user_id, feature, model, input_tokens, output_tokens)
     select $1, 'explanation', 'claude-haiku-4-5', 1000, 200 from generate_series(1, 20)`,
    [`test:${heavyName}`],
  );

  await signInAsReviewer(page, '/admin/billing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Subscriptions and payments');
  // The tests' server has no Stripe: the page says so rather than failing.
  await expect(page.getByText('Stripe is not set up on this server')).toBeVisible();
  await page.getByRole('link', { name: 'past due' }).click();
  await expect(page).toHaveURL(/status=past_due/);
  const held = page.getByTestId('subscription-row').filter({ hasText: `Ada ${name}` });
  await expect(held).toContainText('pro_yearly');
  await expect(held).toContainText('will not renew');
  // Refunds are made in Stripe: the row links to the subscription there, in test mode.
  await expect(held.getByRole('link', { name: 'Open, refund' })).toHaveAttribute(
    'href',
    /^https:\/\/dashboard\.stripe\.com\/test\/subscriptions\/sub_e2e/,
  );
  await expectAccessibleInBothThemes(page, 'admin billing');

  // The development server compiles each page the first time it is opened.
  await page.getByRole('link', { name: 'Organizations' }).click();
  await page.waitForURL(/\/admin\/orgs$/, { timeout: 120_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Organizations');
  await expectAccessibleInBothThemes(page, 'admin organizations');

  await page.getByRole('link', { name: 'AI use' }).click();
  await page.waitForURL(/\/admin\/ai$/, { timeout: 120_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AI use');
  await expect(page.getByTestId('ai-service-use')).toContainText('of 5,000 requests');
  // The learner at their limit is counted in the notice and marked in the table.
  await expect(
    page.getByRole('status').filter({ hasText: /reached their own daily limit/ }),
  ).toBeVisible();
  const heavy = page.getByTestId('ai-user').filter({ hasText: `test:${heavyName}` });
  await expect(heavy).toContainText('20 of 20');
  await expect(heavy).toContainText('At the limit');
  await expect(heavy).toContainText('Free');
  // 20 requests of 1,000 tokens in and 200 out, at list price.
  await expect(heavy).toContainText('$0.04');
  const today = new Date().toISOString().slice(0, 10);
  await expect(page.getByTestId('ai-day').filter({ hasText: today })).toBeVisible();
  await expectAccessibleInBothThemes(page, 'admin AI use');
});
