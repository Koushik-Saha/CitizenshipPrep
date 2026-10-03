import { describe, expect, it } from 'vitest';

import { ApiError, createOathlyApi } from './client';
import type { Me } from './me';

const me: Me = {
  profile: { id: 'user-1', displayName: null },
  settings: { dailyGoalMinutes: 15, onboardedAt: '2026-10-02T00:00:00.000Z' },
  studyCountries: [],
  progress: { attempts: 0, questionsAnswered: 0, correctAnswers: 0 },
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
});
