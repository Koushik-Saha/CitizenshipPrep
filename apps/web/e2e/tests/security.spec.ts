import { randomUUID } from 'node:crypto';

import { expect, test, type APIRequestContext } from '@playwright/test';

import { newLearner, signInAndOnboard } from './support';

// The API as an attacker meets it: no session, malformed input, somebody
// else's ids, too many calls. And the headers every response carries.

const json = { 'content-type': 'application/json' };

test('every learner endpoint refuses a caller with no session', async ({ request }) => {
  const calls: [string, string, unknown?][] = [
    ['GET', '/api/me'],
    ['GET', '/api/countries'],
    ['GET', '/api/study/dashboard'],
    ['GET', `/api/study/sessions/${randomUUID()}`],
    ['GET', '/api/packs/zz'],
    ['GET', `/api/orgs/${randomUUID()}/report`],
    ['DELETE', '/api/me'],
    ['POST', '/api/answers', { answers: [] }],
    ['POST', '/api/explain', { questionId: randomUUID() }],
    ['POST', '/api/tutor', { countryCode: 'ZZ', messages: [] }],
    ['POST', '/api/me/onboarding', {}],
    ['POST', '/api/me/time-zone', { timeZone: 'UTC' }],
    ['POST', '/api/me/exam-result', { countryCode: 'ZZ', result: 'passed' }],
    ['POST', '/api/study/sessions', {}],
    ['POST', '/api/study/sessions/offline', { attempts: [] }],
    ['POST', `/api/attempts/${randomUUID()}/complete`, { correct: 1, total: 1, passed: null }],
  ];
  for (const [method, path, data] of calls) {
    const response = await request.fetch(path, { method, data, headers: json });
    expect(response.status(), `${method} ${path}`).toBe(401);
  }
});

test('webhooks and the publish hook refuse callers without their secret', async ({ request }) => {
  const revalidate = await request.post('/api/revalidate', { data: {}, headers: json });
  expect(revalidate.status()).toBe(401);
  const stripe = await request.post('/api/billing/stripe/webhook', { data: {}, headers: json });
  expect([400, 503]).toContain(stripe.status());
  const revenuecat = await request.post('/api/billing/revenuecat/webhook', {
    data: { event: { id: 'x', type: 'INITIAL_PURCHASE' } },
    headers: json,
  });
  expect([401, 503]).toContain(revenuecat.status());
});

test('the test sign-in needs its secret', async ({ request }) => {
  const response = await request.get('/api/test/sign-in?user=learner&secret=wrong', {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(404);
  expect(response.headers()['set-cookie'] ?? '').toBe('');
});

test.describe('signed in', () => {
  let api: APIRequestContext;

  test.beforeEach(async ({ page }) => {
    await signInAndOnboard(page);
    api = page.request;
  });

  test('malformed input is refused before anything is done with it', async () => {
    const bad: [string, unknown][] = [
      ['/api/answers', { answers: 'not a list' }],
      ['/api/answers', { answers: Array.from({ length: 101 }, () => ({})) }],
      ['/api/explain', { questionId: "1'; drop table questions; --" }],
      ['/api/explain', {}],
      ['/api/tutor', { countryCode: 'Testland', messages: [] }],
      ['/api/tutor', { countryCode: 'ZZ', messages: 'hello' }],
      ['/api/me/time-zone', { timeZone: 42 }],
      ['/api/me/time-zone', { timeZone: 'x'.repeat(200) }],
      ['/api/me/exam-result', { countryCode: 'ZZ', result: 'excellent' }],
      ['/api/me/exam-result', { countryCode: 'ZZZ', result: 'passed' }],
      [
        '/api/study/sessions',
        { kind: 'practice', countryCode: 'ZZ', focus: 'random', size: 100000 },
      ],
      ['/api/study/sessions', { kind: 'mock_exam', countryCode: 'ZZ', examFormatId: 'nope' }],
      ['/api/study/sessions/offline', { attempts: [{ attemptId: 'nope' }] }],
      [`/api/attempts/${randomUUID()}/complete`, { correct: 'all', total: 10, passed: null }],
      [`/api/attempts/${randomUUID()}/complete`, { correct: -1, total: 10, passed: null }],
    ];
    for (const [path, data] of bad) {
      const response = await api.post(path, { data, headers: json });
      expect(response.status(), `${path} ${JSON.stringify(data).slice(0, 60)}`).toBe(400);
    }
    // Not JSON at all.
    const garbage = await api.post('/api/explain', { data: '{"questionId":', headers: json });
    expect(garbage.status()).toBe(400);
  });

  test('ids that are not ids are not found, rather than an error', async () => {
    expect((await api.get('/api/study/sessions/not-an-id')).status()).toBe(404);
    expect((await api.get('/api/orgs/not-an-id/report')).status()).toBe(404);
    expect((await api.get('/api/orgs/not-an-id/logo')).status()).toBe(404);
    expect((await api.get('/api/packs/zzz')).status()).toBe(404);
    const complete = await api.post('/api/attempts/not-an-id/complete', {
      data: { correct: 1, total: 1, passed: null },
      headers: json,
    });
    expect(complete.status()).toBe(404);
  });

  test('one malformed answer is refused for good while the batch is accepted', async () => {
    const response = await api.post('/api/answers', {
      data: { answers: [{ clientEventId: 'not-a-uuid' }, null, 7] },
      headers: json,
    });
    expect(response.status()).toBe(200);
    const outcome = await response.json();
    expect(outcome.accepted).toEqual([]);
    expect(outcome.rejected).toHaveLength(3);
    expect(outcome.rejected.every((answer: { permanent: boolean }) => answer.permanent)).toBe(true);
  });

  test('a learner cannot read or finish another learner’s session', async ({ browser }) => {
    const started = await api.post('/api/study/sessions', {
      data: { kind: 'practice', countryCode: 'ZZ', focus: 'random', size: 5 },
      headers: json,
    });
    expect(started.status()).toBe(200);
    const { attemptId } = await started.json();
    expect((await api.get(`/api/study/sessions/${attemptId}`)).status()).toBe(200);

    const context = await browser.newContext();
    const other = await context.newPage();
    await signInAndOnboard(other);
    expect((await other.request.get(`/api/study/sessions/${attemptId}`)).status()).toBe(404);
    const finish = await other.request.post(`/api/attempts/${attemptId}/complete`, {
      data: { correct: 5, total: 5, passed: null },
      headers: json,
    });
    // Accepted and ignored: nothing of theirs matched.
    expect(finish.status()).toBe(204);
    const mine = await (await api.get(`/api/study/sessions/${attemptId}`)).json();
    expect(mine.completedAt).toBeNull();
    await context.close();
  });

  test('a result can only be reported for an exam the learner is studying for', async () => {
    const elsewhere = await api.post('/api/me/exam-result', {
      data: { countryCode: 'QQ', result: 'passed' },
      headers: json,
    });
    expect(elsewhere.status()).toBe(404);
    const here = await api.post('/api/me/exam-result', {
      data: { countryCode: 'zz', result: 'failed' },
      headers: json,
    });
    expect(here.status()).toBe(200);
    expect((await here.json()).countries[0].examResult).toBe('failed');
  });

  test('a request another site makes with the learner’s cookie is treated as signed out', async () => {
    const forged = await api.post('/api/me/exam-result', {
      data: { countryCode: 'ZZ', result: 'passed' },
      // What a browser sends when a page on another site posts here.
      headers: { 'content-type': 'text/plain', origin: 'https://evil.example' },
    });
    expect(forged.status()).toBe(401);
    const dashboard = await (await api.get('/api/study/dashboard')).json();
    expect(dashboard.countries[0].examResult).toBeNull();
    // The same request from this site goes through.
    const own = await api.post('/api/me/time-zone', {
      data: { timeZone: 'Europe/Berlin' },
      headers: { ...json, origin: new URL(test.info().project.use.baseURL!).origin },
    });
    expect(own.status()).toBe(204);
  });

  test('another site cannot delete the learner’s account with their cookie', async () => {
    const forged = await api.delete('/api/me', { headers: { origin: 'https://evil.example' } });
    expect(forged.status()).toBe(401);
    expect((await api.get('/api/me')).status()).toBe(200);
  });

  test('AI explanations are rate limited per learner', async () => {
    // A question that does not exist is answered 404 without reaching the AI,
    // but it is still a call, and calls are what is counted: 20 a minute.
    // Counting restarts each minute by the clock, so a run that straddles the
    // minute gets further before it is refused; it is never refused sooner.
    let refusedAt = 0;
    for (let i = 1; i <= 45 && !refusedAt; i += 1) {
      const response = await api.post('/api/explain', {
        data: { questionId: randomUUID() },
        headers: json,
      });
      if (response.status() === 429) {
        refusedAt = i;
        expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0);
        expect((await response.json()).code).toBe('RATE_LIMITED');
      } else {
        expect(response.status(), `call ${i}`).toBe(404);
      }
    }
    expect(refusedAt).toBeGreaterThanOrEqual(21);
  });
});

test('sign-in emails are rate limited per recipient and per network address', async ({
  request,
}) => {
  // Up to seventy requests, each of which fails upstream before it answers.
  test.slow();
  // Sign-in points nowhere in these tests, so a request that gets through
  // fails upstream (5xx). What matters is when it stops getting through.
  const address = `203.0.113.${Math.floor(Math.random() * 250) + 1}, 10.0.0.1`;
  const send = (email: string, from = address) =>
    request.post('/api/auth/email-otp/send-verification-otp', {
      data: { email, type: 'sign-in' },
      headers: { ...json, 'x-forwarded-for': from },
    });

  // Five to one inbox, then no more, whichever address asks. (Counting
  // restarts each quarter of an hour by the clock: a run that straddles one
  // gets a few further, never fewer.)
  const inbox = `${newLearner()}@example.test`;
  let stoppedAt = 0;
  for (let i = 1; i <= 11 && !stoppedAt; i += 1) {
    const response = await send(i % 2 ? inbox : inbox.toUpperCase(), `198.51.100.${i}`);
    if (response.status() === 429) {
      stoppedAt = i;
      expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0);
    }
  }
  expect(stoppedAt).toBeGreaterThanOrEqual(6);

  // Typing a code in names the address too, but sends nothing: it is not
  // counted against the inbox, or nobody could sign in twice in a row.
  const typed = await request.post('/api/auth/sign-in/email-otp', {
    data: { email: inbox, otp: '000000' },
    headers: { ...json, 'x-forwarded-for': '198.51.100.200' },
  });
  expect(typed.status()).not.toBe(429);

  // Thirty from one address, to different inboxes, then no more.
  const flooding = `203.0.113.${Math.floor(Math.random() * 250) + 1}, 10.0.0.2`;
  let refusedAt = 0;
  for (let i = 1; i <= 62 && !refusedAt; i += 1) {
    if ((await send(`${newLearner()}@example.test`, flooding)).status() === 429) refusedAt = i;
  }
  expect(refusedAt).toBeGreaterThanOrEqual(31);
});

test('every response carries the security headers', async ({ request }) => {
  for (const path of ['/', '/testland/citizenship-test', '/api/public/countries', '/sign-in']) {
    const headers = (await request.get(path)).headers();
    expect(headers['x-content-type-options'], path).toBe('nosniff');
    expect(headers['x-frame-options'], path).toBe('DENY');
    expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy'], path).toContain('camera=()');
    const csp = headers['content-security-policy'];
    expect(csp, path).toContain("frame-ancestors 'none'");
    expect(csp, path).toContain("object-src 'none'");
    expect(csp, path).toContain("base-uri 'self'");
    expect(headers['x-powered-by'], path).toBeUndefined();
  }
});

test('no page breaks its own content security policy', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to|Couldn't load/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  // The landing page's globe arrives after the page is idle and loads a
  // model, textures, a worker and WebAssembly: wait for it, since it is the
  // part most likely to ask for something the policy forgot.
  await page.goto('/');
  await expect(page.locator('canvas')).toBeAttached({ timeout: 60_000 });
  await page.waitForTimeout(4000);
  for (const path of ['/countries', '/testland/citizenship-test', '/sign-in']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await signInAndOnboard(page);
  await page.goto('/study/plans');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(violations).toEqual([]);
});
