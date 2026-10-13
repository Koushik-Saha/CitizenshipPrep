import { readdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type APIRequestContext } from '@playwright/test';

import { auditTrail, removeStaff, resetAuthenticator } from '../../database';
import { newLearner, signInAndOnboard, signInAsReviewer, signInAsStaffAccount } from '../support';

// Who can reach the reviewers' area: nobody without a staff role and a code
// from their authenticator. The routes are read from the app's own folders,
// so a page or an endpoint added later is tested without anyone adding it
// here.

const appDir = path.join(process.cwd(), 'src/app');
const ID = '00000000-0000-4000-8000-000000000000';

/** Every file of a kind under a folder. */
function filesNamed(dir: string, names: readonly string[]): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesNamed(full, names);
    return names.includes(entry.name) ? [full] : [];
  });
}

/** The address a route file answers at: groups dropped, parameters filled in. */
function addressOf(file: string): string {
  const segments = path
    .relative(appDir, path.dirname(file))
    .split(path.sep)
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .map((segment) => (segment === '[locale]' ? 'es' : /^\[.*\]$/.test(segment) ? ID : segment));
  return `/${segments.join('/')}`;
}

const all = filesNamed(appDir, ['page.tsx', 'route.ts']).map((file) => ({
  address: addressOf(file),
  isPage: file.endsWith('page.tsx'),
}));
/** Every page and endpoint of the reviewers' area, wherever its file lives. */
const adminRoutes = all.filter(
  ({ address }) =>
    address === '/admin' || address.startsWith('/admin/') || address.startsWith('/api/admin'),
);
/** The pages only an admin may open: a reviewer is sent back to the queue. */
const adminOnly = [
  '/admin/activity',
  '/admin/users',
  `/admin/users/${ID}`,
  '/admin/billing',
  '/admin/orgs',
  '/admin/ai',
];

/** Asks for a route and follows it to where it ends. */
async function endsAt(request: APIRequestContext, method: 'GET' | 'POST', address: string) {
  const first = await request.fetch(address, {
    method,
    maxRedirects: 0,
    failOnStatusCode: false,
    ...(method === 'POST' ? { form: { decision: 'approve', ids: ID } } : {}),
  });
  const final = await request.fetch(address, { method, failOnStatusCode: false });
  return { first: first.status(), location: first.headers().location ?? '', final: final.url() };
}

test('the list of admin routes is read from the app, and is not empty', () => {
  const addresses = adminRoutes.map((route) => route.address);
  expect(addresses).toEqual(expect.arrayContaining(['/admin', '/admin/content', '/admin/sign-in']));
  expect(addresses).toEqual(expect.arrayContaining(adminOnly));
  expect(addresses.length).toBeGreaterThanOrEqual(7);
});

test('a signed-out visitor is redirected away from every admin route', async ({ request }) => {
  test.slow();
  for (const { address } of adminRoutes) {
    for (const method of ['GET', 'POST'] as const) {
      const result = await endsAt(request, method, address);
      const where = `${method} ${address}`;
      expect([303, 307], `${where}: ${result.first}`).toContain(result.first);
      // Out of the admin area altogether: the site's own sign-in.
      const landed = new URL(result.final).pathname;
      expect(landed, where).toBe('/sign-in');
    }
  }
});

test('a signed-in learner with no staff role is redirected away from every admin route', async ({
  page,
}) => {
  test.slow();
  const user = await signInAndOnboard(page, { user: newLearner() });
  for (const { address } of adminRoutes) {
    for (const method of ['GET', 'POST'] as const) {
      const result = await endsAt(page.request, method, address);
      const where = `${method} ${address}`;
      expect([303, 307], `${where}: ${result.first}`).toContain(result.first);
      // To the front page, with nothing said about why.
      expect(new URL(result.final).pathname, where).toBe('/');
    }
  }
  // In a browser too: no admin page is ever drawn for them.
  for (const { address, isPage } of adminRoutes) {
    if (!isPage) continue;
    await page.goto(address);
    await expect(page, address).toHaveURL(/\/$/);
  }
  // And nothing they tried was done: the record has no action of theirs.
  expect(await auditTrail(`test:${user}`)).toEqual([]);
});

test('a staff account is not let in on the role alone: it needs its code', async ({ page }) => {
  test.slow();
  await signInAsStaffAccount(page, 'admin');
  for (const { address } of adminRoutes) {
    if (address === '/admin/sign-in') continue;
    const result = await endsAt(page.request, 'GET', address);
    expect(result.first, address).toBe(307);
    expect(new URL(result.final).pathname, address).toBe('/admin/sign-in');
  }
});

test('a session earned by one account is no use to another', async ({ page, browser }) => {
  test.slow();
  await signInAsReviewer(page);
  const stolen = (await page.context().cookies()).find((cookie) => cookie.name === 'oathly_admin')!;
  expect(stolen.httpOnly).toBe(true);
  expect(stolen.path).toBe('/admin');

  // A learner who has got hold of it.
  const learnerContext = await browser.newContext();
  const learner = await learnerContext.newPage();
  await signInAndOnboard(learner, { user: newLearner() });
  await learnerContext.addCookies([stolen]);
  await learner.goto('/admin/content');
  await expect(learner).toHaveURL(/\/$/);

  // Another member of staff who has not entered their own code.
  const staffContext = await browser.newContext();
  const other = await staffContext.newPage();
  await signInAsStaffAccount(other, 'admin');
  await staffContext.addCookies([stolen]);
  await other.goto('/admin/content');
  await expect(other).toHaveURL(/\/admin\/sign-in/);

  // Nobody signed in at all.
  const nobodyContext = await browser.newContext();
  await nobodyContext.addCookies([stolen]);
  const nobody = await nobodyContext.newPage();
  await nobody.goto('/admin/content');
  await expect(nobody).toHaveURL(/\/sign-in\?admin=1$/);
  await Promise.all([learnerContext.close(), staffContext.close(), nobodyContext.close()]);
});

test('signing out ends the session wherever a copy of it is', async ({ page, browser }) => {
  test.slow();
  const { userId } = await signInAsReviewer(page);
  const cookies = await page.context().cookies();
  // The same account in another browser, with a copy of both of its cookies.
  const copyContext = await browser.newContext();
  await copyContext.addCookies(cookies);
  const copy = await copyContext.newPage();
  await copy.goto('/admin/content');
  await expect(copy.getByRole('heading', { level: 1 })).toHaveText('Review queue');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in/);

  // The copy is over too: it is asked for a code again.
  await copy.goto('/admin/content');
  await expect(copy).toHaveURL(/\/admin\/sign-in/);
  await expect(copy.getByRole('heading', { level: 1 })).toHaveText('Enter your code');
  await copyContext.close();
  expect(await auditTrail(userId)).toContain('sign-out');
});

test('an authenticator that has been reset takes its sessions with it', async ({ page }) => {
  test.slow();
  const { userId } = await signInAsReviewer(page);
  await resetAuthenticator(userId);
  await page.goto('/admin/content');
  // Back to setting one up, with a new key.
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Set up your authenticator');
});

test('a reviewer gets the review pages and none of the admin-only ones', async ({ page }) => {
  test.slow();
  await signInAsReviewer(page, '/admin/content', 'reviewer');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review queue');
  await expect(page.getByRole('link', { name: 'Activity' })).toHaveCount(0);
  for (const address of adminOnly) {
    await page.goto(address);
    await expect(page, address).toHaveURL(/\/admin\/content$/);
  }
});

test('losing the role ends the session at once', async ({ page }) => {
  test.slow();
  const { userId } = await signInAsReviewer(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review queue');
  await removeStaff(userId);
  await page.goto('/admin/content');
  await expect(page).toHaveURL(/\/$/);
});

test('an admin can read the record of what staff have done', async ({ page }) => {
  test.slow();
  const { userId } = await signInAsReviewer(page);
  await page.getByRole('link', { name: 'Activity' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Activity');
  await page.getByLabel('Account id').fill(userId);
  await page.getByRole('button', { name: 'Filter' }).click();
  await expect(page.getByRole('cell', { name: 'sign-in.accepted' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'second-factor.enrolled' })).toBeVisible();
});
