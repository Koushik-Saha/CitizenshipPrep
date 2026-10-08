import { expect, test } from '@playwright/test';

import { expectAccessibleInBothThemes, newLearner, signInAndOnboard, t } from './support';

// Organizations: an admin creates one and reaches its console; nobody else
// can. Seats are bought through Stripe, which these tests never touch, so an
// organization here has none.

test('an admin creates an organization; its pages are theirs alone', async ({ page, browser }) => {
  // Many pages, each checked in both themes.
  test.slow();
  await signInAndOnboard(page);
  await page.goto('/org');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectAccessibleInBothThemes(page, 'organizations');

  const name = `E2E School ${newLearner().slice(-6)}`;
  await page.getByLabel(t('org.name')).fill(name);
  await page.getByRole('button', { name: t('org.createButton') }).click();
  await expect(page).toHaveURL(/\/org\/e2e-school-[a-z0-9-]+/);
  const console = new URL(page.url()).pathname.replace(/\/(invite|settings)$/, '');
  await page.goto(console);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
  await expectAccessibleInBothThemes(page, 'organization console');

  for (const [path, label] of [
    ['/invite', 'organization invitations'],
    ['/settings', 'organization settings'],
    ['/report', 'organization report'],
  ] as const) {
    await page.goto(console + path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessibleInBothThemes(page, label);
  }

  // Without a seat, nobody can be invited as a learner.
  await page.goto(`${console}/invite`);
  await page.getByLabel(t('org.inviteEmails')).fill('learner@example.test');
  await page.getByRole('button', { name: t('org.inviteButton') }).click();
  await expect(
    page.getByText(t('org.inviteNoSeats', { emails: 'learner@example.test' })),
  ).toBeVisible();
  await expectAccessibleInBothThemes(page, 'organization invitations, refused');

  // An admin takes no seat. With no mail service here, the invitation's link
  // is shown to be passed on; it opens for someone who is not signed in.
  await page.getByLabel(t('org.inviteEmails')).fill('colleague@example.test');
  await page.getByLabel(t('org.inviteAsAdmins')).check();
  await page.getByRole('button', { name: t('org.inviteButton') }).click();
  const link = await page.getByLabel('colleague@example.test').inputValue();
  const visitor = await browser.newContext();
  const invited = await visitor.newPage();
  await invited.goto(new URL(link).pathname);
  await expect(invited.getByRole('heading', { level: 1 })).toContainText(name);
  await expectAccessibleInBothThemes(invited, 'invitation');
  await visitor.close();

  // Someone else is told there is nothing there, on every page of it.
  const other = await browser.newContext();
  const stranger = await other.newPage();
  await signInAndOnboard(stranger);
  for (const path of ['', '/invite', '/settings', '/report']) {
    await stranger.goto(console + path);
    await expect(stranger.getByRole('heading', { level: 1 }), path).toHaveText(
      t('common.notFoundTitle'),
    );
    await expect(stranger.getByText(name)).toHaveCount(0);
  }
  await other.close();
});
