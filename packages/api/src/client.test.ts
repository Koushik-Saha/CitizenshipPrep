import { describe, expect, it } from 'vitest';

import { ApiError, createOathlyApi } from './client';
import type { Me } from './me';

const me: Me = {
  profile: { id: 'user-1', displayName: null },
  settings: { dailyGoalMinutes: 15, onboardedAt: '2026-10-02T00:00:00.000Z' },
  studyCountries: [],
  progress: { attempts: 0, questionsAnswered: 0, correctAnswers: 0 },
  entitlements: [],
  organizations: [],
};

function fakeFetch(status: number, body: unknown, seen: Request[] = []): typeof fetch {
  return async (input, init) => {
    seen.push(new Request(input as URL, init));
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
}

describe('createOathlyApi', () => {
  it('sends the token and parses the response', async () => {
    const seen: Request[] = [];
    const api = createOathlyApi({
      baseUrl: 'https://oathly.test',
      getToken: async () => 'jwt-123',
      fetch: fakeFetch(200, me, seen),
    });
    await expect(api.me()).resolves.toEqual(me);
    expect(seen[0]!.url).toBe('https://oathly.test/api/me');
    expect(seen[0]!.headers.get('authorization')).toBe('Bearer jwt-123');
  });

  it('posts onboarding answers as JSON', async () => {
    const seen: Request[] = [];
    const api = createOathlyApi({
      baseUrl: 'https://oathly.test',
      getToken: async () => 't',
      fetch: fakeFetch(200, me, seen),
    });
    await api.saveOnboarding({
      countryCode: 'US',
      examDate: null,
      studyLocale: 'en',
      dailyGoalMinutes: 10,
    });
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.headers.get('content-type')).toBe('application/json');
    expect(await seen[0]!.json()).toMatchObject({ countryCode: 'US', dailyGoalMinutes: 10 });
  });

  it('sends queued answers and returns what the server stored', async () => {
    const seen: Request[] = [];
    const outcome = { accepted: ['e1'], rejected: [] };
    const api = createOathlyApi({
      baseUrl: 'https://oathly.test',
      getToken: async () => 't',
      fetch: fakeFetch(200, outcome, seen),
    });
    await expect(
      api.sendAnswers([
        {
          clientEventId: 'e1',
          attemptId: 'a1',
          questionId: 'q1',
          questionVersion: 1,
          selectedKeys: ['a'],
          correct: true,
          timeMs: 3_000,
          answeredAt: '2026-10-03T10:00:00.000Z',
        },
      ]),
    ).resolves.toEqual(outcome);
    expect(seen[0]!.url).toBe('https://oathly.test/api/answers');
    expect((await seen[0]!.json()).answers).toHaveLength(1);
  });

  it('surfaces the server’s error message', async () => {
    const api = createOathlyApi({
      baseUrl: 'https://oathly.test',
      getToken: async () => 't',
      fetch: fakeFetch(400, { error: 'Choose a country.' }),
    });
    await expect(api.me()).rejects.toEqual(new ApiError('Choose a country.', 400));
  });

  it('does not call the server when signed out', async () => {
    const seen: Request[] = [];
    const api = createOathlyApi({
      baseUrl: 'https://oathly.test',
      getToken: async () => null,
      fetch: fakeFetch(200, me, seen),
    });
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(seen).toHaveLength(0);
  });

  it('rejects a response that does not have the expected shape', async () => {
    const api = createOathlyApi({
      baseUrl: 'https://oathly.test',
      getToken: async () => 't',
      fetch: fakeFetch(200, { nope: true }),
    });
    await expect(api.me()).rejects.toThrow();
  });

  it('relies on the session cookie when no token source is given (the web app)', async () => {
    const seen: RequestInit[] = [];
    const api = createOathlyApi({
      baseUrl: 'https://oathly.test',
      fetch: async (_input, init) => {
        seen.push(init!);
        return Response.json(me);
      },
    });
    await api.me();
    expect(seen[0]).toMatchObject({ credentials: 'same-origin' });
    expect(seen[0]!.headers).not.toHaveProperty('authorization');
  });

  it('starts, loads and completes sessions', async () => {
    const seen: Request[] = [];
    const session = {
      attemptId: 'a/1',
      countryCode: 'ZZ',
      countryName: 'Testland',
      countryLocation: null,
      mode: 'practice',
      startedAt: '2026-10-03T10:00:00.000Z',
      completedAt: null,
      questions: [],
      exam: null,
    };
    const replies: [number, unknown][] = [
      [200, { attemptId: 'a/1' }],
      [200, session],
      [204, null],
    ];
    const api = createOathlyApi({
      baseUrl: 'https://oathly.test',
      getToken: async () => 't',
      fetch: async (input, init) => {
        seen.push(new Request(input as string, init));
        const [status, body] = replies.shift()!;
        return new Response(body === null ? null : JSON.stringify(body), { status });
      },
    });
    await expect(
      api.startSession({ kind: 'practice', countryCode: 'ZZ', focus: 'adaptive', size: 10 }),
    ).resolves.toEqual({ attemptId: 'a/1' });
    await expect(api.session('a/1')).resolves.toEqual(session);
    await expect(
      api.completeSession('a/1', { correct: 3, total: 4, passed: null }),
    ).resolves.toBeUndefined();
    expect(seen.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toEqual([
      'POST /api/study/sessions',
      'GET /api/study/sessions/a%2F1',
      'POST /api/attempts/a%2F1/complete',
    ]);
    expect(await seen[2]!.json()).toEqual({ correct: 3, total: 4, passed: null });
  });

  it('reads the dashboard and a country pack, and registers offline sessions', async () => {
    const seen: Request[] = [];
    const dashboard = { streakDays: 1, minutesToday: 0, dailyGoalMinutes: 15, countries: [] };
    const pack = {
      countryCode: 'ZZ',
      countryName: 'Testland',
      countryLocation: null,
      generatedAt: '2026-10-03T10:00:00.000Z',
      examFormats: [],
      questions: [],
      history: [],
    };
    const replies: [number, unknown][] = [
      [200, dashboard],
      [200, pack],
      [204, null],
      [204, null],
      [500, 'oops'],
    ];
    const api = createOathlyApi({
      baseUrl: 'https://oathly.test',
      getToken: async () => 't',
      fetch: async (input, init) => {
        seen.push(new Request(input as string, init));
        const [status, body] = replies.shift()!;
        return new Response(body === null ? null : JSON.stringify(body), { status });
      },
    });
    await expect(api.dashboard()).resolves.toEqual(dashboard);
    await expect(api.countryPack('ZZ')).resolves.toEqual(pack);
    await api.registerOfflineAttempts([]);
    await api.setTimeZone('Europe/Berlin');
    await expect(api.dashboard()).rejects.toEqual(new ApiError('Request failed (500).', 500));
    expect(seen.map((request) => new URL(request.url).pathname)).toEqual([
      '/api/study/dashboard',
      '/api/packs/ZZ',
      '/api/study/sessions/offline',
      '/api/me/time-zone',
      '/api/study/dashboard',
    ]);
  });
});
