import { expect, test, type Browser, type Page } from '@playwright/test';

import { sql } from '../database';
import {
  expectAccessible,
  expectAccessibleInBothThemes,
  newLearner,
  signIn,
  signInAndOnboard,
  signInAsReviewer,
  t,
} from './support';

// A country's study group: posting, reading, marking helpful, commenting, and
// what happens to a post that asks about the writer's own immigration case.
// The test server has no model, so the built-in rules do the screening.

async function learner(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAndOnboard(page, { user: newLearner() });
  return page;
}

async function write(page: Page, title: string, body: string): Promise<void> {
  await page.goto('/study/community');
  await page.getByText(t('community.newPost'), { exact: true }).click();
  await page.getByLabel(t('community.titleLabel')).fill(title);
  await page.getByLabel(t('community.bodyLabel')).fill(body);
  await page.getByRole('button', { name: t('community.post'), exact: true }).click();
  await expect(page).toHaveURL(/\/study\/community\/[0-9a-f-]{36}/);
}

test('a learner posts, and others in the group read, mark it helpful and comment', async ({
  browser,
}) => {
  test.slow();
  const tag = Math.random().toString(36).slice(2, 8);
  const title = `How long did you study? ${tag}`;
  const writer = await learner(browser);
  const reader = await learner(browser);

  // From the dashboard to the group.
  await writer.goto('/study');
  await writer.getByRole('link', { name: /Study group for Testland/ }).click();
  await expect(writer.getByRole('heading', { level: 1 })).toHaveText(t('community.title'));
  await expectAccessibleInBothThemes(writer, 'study group');

  await write(writer, title, 'I have six weeks until my test. Is that enough?');
  await expect(writer.getByRole('heading', { level: 1 })).toHaveText(title);
  // Nothing held it back.
  await expect(writer.getByText(t('community.held'))).toHaveCount(0);
  await expectAccessibleInBothThemes(writer, 'study group post');

  await reader.goto('/study/community');
  await reader.getByRole('link', { name: title }).click();
  const helpful = reader.getByRole('button', { name: new RegExp(`^${t('community.helpful')}`) });
  await expect(helpful).toHaveAttribute('aria-pressed', 'false');
  await helpful.click();
  await expect(helpful).toHaveAttribute('aria-pressed', 'true');
  await expect(helpful).toContainText('1');

  await reader.getByLabel(t('community.commentLabel')).fill('Six weeks was plenty for me.');
  await reader.getByRole('button', { name: t('community.comment'), exact: true }).click();
  await expect(reader.getByTestId('community-comment')).toContainText(
    'Six weeks was plenty for me.',
  );

  // The writer sees both, cannot mark their own post, and it shows in the list with its counts.
  await writer.reload();
  await expect(writer.getByTestId('community-comment')).toHaveCount(1);
  await expect(
    writer.getByRole('button', { name: new RegExp(`^${t('community.helpful')}`) }),
  ).toHaveCount(0);
  await writer.goto('/study/community?sort=top');
  const card = writer.getByTestId('community-post').filter({ hasText: title });
  await expect(card).toContainText(t('community.helpfulCount', { count: 1 }));
  await expect(card).toContainText(t('community.commentCount', { count: 1 }));

  // A report is taken, once.
  await reader.getByText(t('community.report'), { exact: true }).first().click();
  await reader
    .getByRole('button', { name: t('community.reportSend') })
    .first()
    .click();
  await expect(
    reader.getByRole('status').filter({ hasText: t('community.reported') }),
  ).toBeVisible();
});

test('back from a new post the group lists it, and a comment sent twice is posted once', async ({
  browser,
}) => {
  test.slow();
  const tag = Math.random().toString(36).slice(2, 8);
  const page = await learner(browser);
  // The way a learner goes: from the dashboard to the group, and a post written there.
  await page.getByRole('link', { name: /Study group for Testland/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('community.title'));
  const title = `First week of study ${tag}`;
  await page.getByText(t('community.newPost'), { exact: true }).click();
  await page.getByLabel(t('community.titleLabel')).fill(title);
  await page
    .getByLabel(t('community.bodyLabel'))
    .fill('Starting today. Any tips for the first week?');
  await page.getByRole('button', { name: t('community.post'), exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await page.getByRole('link', { name: t('community.back') }).click();
  await expect(page).toHaveURL(/\/study\/community\?country=ZZ$/);
  await expect(page.getByTestId('community-post').filter({ hasText: title })).toBeVisible();

  // A slow answer from the server, and the button clicked again and again meanwhile.
  await page.getByRole('link', { name: title }).click();
  await page.route(/\/study\/community\//, async (route) => {
    if (route.request().method() === 'POST') await new Promise((done) => setTimeout(done, 1_500));
    await route.continue();
  });
  const body = `Read the guide first. ${tag}`;
  await page.getByLabel(t('community.commentLabel')).fill(body);
  const send = page.getByRole('button', { name: t('community.comment'), exact: true });
  await send.dblclick();
  await expect(page.getByRole('status').filter({ hasText: t('community.sending') })).toBeVisible();
  await expect(send).toHaveAttribute('aria-busy', 'true');
  await send.click();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('community-comment')).toContainText(body);
  await page.unroute(/\/study\/community\//);
  await page.reload();
  await expect(page.getByTestId('community-comment').filter({ hasText: body })).toHaveCount(1);
});

test('a writer deletes their own post, and only they can', async ({ browser }) => {
  test.slow();
  const tag = Math.random().toString(36).slice(2, 8);
  const title = `Posted by mistake ${tag}`;
  const writer = await learner(browser);
  const reader = await learner(browser);
  await write(writer, title, 'I meant to post this in another group.');
  const address = writer.url();

  // Someone else is not offered it.
  await reader.goto(address);
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(reader.getByText(t('community.deletePost'), { exact: true })).toHaveCount(0);

  // The writer is, and is told what it does before it is done.
  await writer.getByText(t('community.deletePost'), { exact: true }).click();
  await expect(writer.getByText(t('community.deleteConfirm'))).toBeVisible();
  await expectAccessible(writer, 'study group post, about to delete');
  await writer.getByRole('button', { name: t('community.deleteSend'), exact: true }).click();
  await expect(writer).toHaveURL(/\/study\/community\?country=ZZ&notice=deleted$/);
  await expect(
    writer.getByRole('status').filter({ hasText: t('community.deleted') }),
  ).toBeVisible();
  await expect(writer.getByTestId('community-post').filter({ hasText: title })).toHaveCount(0);

  // Gone for everyone: its address says so.
  await reader.goto(address);
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText(t('common.notFoundTitle'));
});

test('a post about the writer’s own case is hidden until a moderator has reviewed it', async ({
  browser,
}) => {
  test.slow();
  const tag = Math.random().toString(36).slice(2, 8);
  const title = `My visa was refused, can I still apply? ${tag}`;
  const writer = await learner(browser);
  const reader = await learner(browser);

  await write(writer, title, 'It was refused two years ago and I am not sure what to do.');
  // The writer is told why, and where to turn instead.
  await expect(writer.getByText(t('community.legalTitle'))).toBeVisible();
  await expect(writer.getByText(t('community.legalNotice'))).toBeVisible();
  await expect(writer.getByText(t('community.held'))).toBeVisible();
  await expect(writer.getByLabel(t('community.commentLabel'))).toHaveCount(0);
  await expectAccessible(writer, 'study group post, held');
  const address = new URL(writer.url()).pathname;

  // Nobody else can see it: not in the list, not by its address.
  await reader.goto('/study/community');
  await expect(reader.getByRole('link', { name: title })).toHaveCount(0);
  await reader.goto(address);
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText(t('common.notFoundTitle'));

  // It is in the moderators' queue.
  const moderator = await (await browser.newContext()).newPage();
  await signInAsReviewer(moderator, '/admin/community');
  await expect(moderator.getByRole('heading', { level: 1 })).toHaveText('Community moderation');
  const item = moderator.getByTestId('moderation-item').filter({ hasText: title });
  await expect(item).toContainText('Asks about their own case');
  await expect(item).toContainText('Hidden');
  await expectAccessibleInBothThemes(moderator, 'community moderation');
  await item.getByRole('button', { name: 'Approve and show' }).click();
  await expect(moderator.getByRole('status').filter({ hasText: 'Approved.' })).toBeVisible();
  await expect(moderator.getByTestId('moderation-item').filter({ hasText: title })).toHaveCount(0);

  // Reviewed: the group can read it, with the notice beside it.
  await reader.goto('/study/community');
  await reader.getByRole('link', { name: title }).click();
  await expect(reader.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(reader.getByText(t('community.legalNotice'))).toBeVisible();
  await writer.reload();
  await expect(writer.getByText(t('community.held'))).toHaveCount(0);
});

test('a study group is for signed-in learners who study that country', async ({
  page,
  request,
}) => {
  const signedOut = await request.get('/study/community', { maxRedirects: 0 });
  expect([302, 303, 307]).toContain(signedOut.status());
  await signInAndOnboard(page, { user: newLearner() });
  // Another country's group falls back to their own.
  await page.goto('/study/community?country=US');
  await expect(page.getByText(/Testland/).first()).toBeVisible();
  for (const id of ['not-a-post', '00000000-0000-4000-8000-000000000000']) {
    await page.goto(`/study/community/${id}`);
    await expect(page.getByRole('heading', { level: 1 }), id).toHaveText(t('common.notFoundTitle'));
  }
});

test('someone who has not chosen a test is told how to join a study group', async ({ page }) => {
  // Set up, but with no test chosen: an account that came in another way, such as staff.
  const user = newLearner();
  await sql('insert into public.profiles (id) values ($1)', [`test:${user}`]);
  await sql(
    'insert into public.user_settings (user_id, daily_goal_minutes, onboarded_at) values ($1, 10, now())',
    [`test:${user}`],
  );
  await signIn(page, user);
  await page.goto('/study/community');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('community.title'));
  await expect(page.getByText(t('community.noCountry'))).toBeVisible();
  await expect(page.getByRole('link', { name: t('community.chooseTest') })).toHaveAttribute(
    'href',
    '/onboarding',
  );
  await expectAccessible(page, 'study group, no test chosen');
});
