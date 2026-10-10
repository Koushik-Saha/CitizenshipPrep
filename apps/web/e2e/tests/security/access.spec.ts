import { randomUUID } from 'node:crypto';

import { createPool } from '@oathly/content/db';
import { expect, test, type Page } from '@playwright/test';

import { e2eDatabaseUrl } from '../../database';
import { newLearner, signIn, signInAndOnboard, t } from '../support';

// What a signed-in learner can reach that is not theirs. Each test is an
// attempt that was first made by hand (docs/pentest_2026-10-09.md): tampering
// with requests, opening the reviewers' pages, and putting script in a post.
// What the database itself refuses is in db/tests/015_direct_access.test.sql.

const json = { 'content-type': 'application/json' };

async function query<Row extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<Row[]> {
  const pool = createPool(e2eDatabaseUrl);
  try {
    return (await pool.query<Row>(text, values)).rows;
  } finally {
    await pool.end();
  }
}

test.describe('a learner on the Free plan', () => {
  test.beforeEach(async ({ page }) => {
    await signInAndOnboard(page);
  });

  test('is given the sample of a country’s questions, however they ask', async ({ page }) => {
    const published = await query<{ id: string }>(
      `select id from public.questions where country_code = 'ZZ' and status = 'published'`,
    );
    expect(published.length).toBeGreaterThan(20);

    const pack = await (await page.request.get('/api/packs/ZZ')).json();
    expect(pack.questions.length).toBe(20);

    const started = await page.request.post('/api/study/sessions', {
      data: { kind: 'practice', countryCode: 'ZZ', focus: 'random', size: 100 },
      headers: json,
    });
    const { attemptId } = await started.json();
    const session = await (await page.request.get(`/api/study/sessions/${attemptId}`)).json();
    expect(session.questions.length).toBeLessThanOrEqual(20);

    // An AI explanation would give away a question outside the sample.
    const sampled = new Set<string>(pack.questions.map((question: { id: string }) => question.id));
    const locked = published.find((question) => !sampled.has(question.id))!;
    const explained = await page.request.post('/api/explain', {
      data: { questionId: locked.id },
      headers: json,
    });
    expect(explained.status()).toBe(404);
  });

  test('cannot give themselves a plan by saying they have one', async ({ page }) => {
    const claimed = await page.request.post('/api/me/onboarding', {
      data: {
        countryCode: 'ZZ',
        examDate: null,
        studyLocale: 'en',
        dailyGoalMinutes: 15,
        plan: 'pro_yearly',
        entitlements: [{ plan: 'pro_yearly', status: 'active', provider: 'stripe' }],
      },
      headers: json,
    });
    expect(claimed.status()).toBe(200);
    const me = await (await page.request.get('/api/me')).json();
    expect(me.entitlements).toEqual([]);
    const dashboard = await (await page.request.get('/api/study/dashboard')).json();
    expect(dashboard.countries[0].fullAccess).toBe(false);
  });
});

test.describe('a learner who is not a reviewer', () => {
  test.beforeEach(async ({ page }) => {
    await signInAndOnboard(page);
  });

  test('is sent to the reviewers’ sign-in, with or without a made-up session', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/admin/content');
    await expect(page).toHaveURL(/\/admin\/sign-in/);

    await page.context().addCookies([
      {
        name: 'oathly_admin',
        value: `v1.${Date.now() + 3_600_000}.${'A'.repeat(43)}`,
        url: `${baseURL}/admin`,
      },
    ]);
    await page.goto('/admin/content');
    await expect(page).toHaveURL(/\/admin\/sign-in/);
    await page.goto('/admin/community');
    await expect(page).toHaveURL(/\/admin\/sign-in/);
  });

  test('cannot run a reviewer’s action by posting to its page', async ({ page }) => {
    const [question] = await query<{ id: string; status: string }>(
      `select id, status from public.questions where country_code = 'ZZ' and status = 'published' limit 1`,
    );
    const response = await page.request.post(`/admin/content/questions/${question!.id}`, {
      headers: { 'next-action': '0'.repeat(40), 'content-type': 'text/plain;charset=UTF-8' },
      data: '[]',
      maxRedirects: 0,
    });
    expect([303, 307, 308]).toContain(response.status());
    expect(response.headers().location).toContain('/admin/sign-in');
    const [after] = await query<{ status: string }>(
      'select status from public.questions where id = $1',
      [question!.id],
    );
    expect(after!.status).toBe('published');
  });

  test('cannot see an organization they do not belong to', async ({ page }) => {
    const owner = `test:${newLearner()}`;
    const slug = `e2e-private-${randomUUID().slice(0, 8)}`;
    await query('insert into public.profiles (id) values ($1)', [owner]);
    const [org] = await query<{ id: string }>(
      `insert into public.organizations (name, slug, kind, created_by)
       values ('Somebody else’s school', $1, 'school', $2) returning id`,
      [slug, owner],
    );

    expect((await page.request.get(`/api/orgs/${org!.id}/report`)).status()).toBe(404);
    expect((await page.goto(`/org/${slug}`))!.status()).toBe(404);
    expect((await page.goto(`/org/${slug}/report`))!.status()).toBe(404);

    await page.goto(`/join/${'A'.repeat(32)}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('org.inviteGoneTitle'));
  });
});

test.describe('script in what a learner writes', () => {
  const probe = (page: Page) =>
    page.evaluate(() => ({
      ran: (window as unknown as { __xss?: number }).__xss ?? null,
      injected: document.querySelectorAll(
        'main img[src="x"], main svg[onload], main iframe, main b, main script:not([type])',
      ).length,
    }));

  test('is shown as the text it is, in a post, a comment and a name', async ({ browser }) => {
    test.slow();
    const tag = Math.random().toString(36).slice(2, 8);
    const title = `<b>bold</b> <img src=x onerror=window.__xss=1> ${tag}`;
    const body = `"><svg onload=window.__xss=2> <script>window.__xss=3</script> the guide helped me`;
    const name = `<img src=x onerror=window.__xss=4>`;

    const writerContext = await browser.newContext();
    const writer = await writerContext.newPage();
    const writerId = await signInAndOnboard(writer);
    // A name with markup in it, as if it had come from the sign-in provider.
    await query('update public.profiles set display_name = $1 where id = $2', [
      name,
      `test:${writerId}`,
    ]);

    await writer.goto('/study/community');
    await writer.getByText(t('community.newPost'), { exact: true }).click();
    await writer.getByLabel(t('community.titleLabel')).fill(title);
    await writer.getByLabel(t('community.bodyLabel')).fill(body);
    await writer.getByRole('button', { name: t('community.post'), exact: true }).click();
    await expect(writer).toHaveURL(/\/study\/community\/[0-9a-f-]{36}/);
    const address = new URL(writer.url()).pathname;
    await expect(writer.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(writer.locator('main:not([aria-busy])')).toContainText(
      '<svg onload=window.__xss=2>',
    );
    expect(await probe(writer)).toEqual({ ran: null, injected: 0 });

    const readerContext = await browser.newContext();
    const reader = await readerContext.newPage();
    await signInAndOnboard(reader);
    await reader.goto('/study/community');
    await expect(reader.locator('main:not([aria-busy])')).toContainText(tag);
    expect(await probe(reader)).toEqual({ ran: null, injected: 0 });

    await reader.goto(address);
    await expect(reader.locator('main:not([aria-busy])')).toContainText(name);
    await reader
      .locator('textarea[name="body"]')
      .fill('<iframe src="javascript:window.__xss=5"></iframe> thank you');
    await reader.getByRole('button', { name: t('community.comment'), exact: true }).click();
    await expect(reader).toHaveURL(/notice=/);
    await expect(reader.locator('main:not([aria-busy])')).toContainText(
      '<iframe src="javascript:window.__xss=5">',
    );
    expect(await probe(reader)).toEqual({ ran: null, injected: 0 });

    await writerContext.close();
    await readerContext.close();
  });

  test('links in a study group keep to the page’s language', async ({ page }) => {
    await signIn(page, 'estudiante');
    await page.goto('/es/study/community');
    const links = await page
      .locator('main a[href*="/study/community"]')
      .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')!));
    expect(links.length).toBeGreaterThan(0);
    for (const href of links) expect(href).toMatch(/^\/es\/study\/community/);
  });
});
