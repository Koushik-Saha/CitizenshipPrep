import { describe, expect, it } from 'vitest';

import { ApiError, type OathlyApi } from './client';
import type { Me } from './me';
import { loadSession, looksLikeEmail, normalizeCode } from './session';

const me: Me = {
  profile: { id: 'user-1', displayName: null },
  settings: null,
  studyCountries: [],
  progress: { attempts: 0, questionsAnswered: 0, correctAnswers: 0 },
};

const api = (result: Me | Error): OathlyApi => ({
  me: async () => {
    if (result instanceof Error) throw result;
    return result;
  },
  countries: async () => [],
  saveOnboarding: async () => me,
  sendAnswers: async () => ({ accepted: [], rejected: [] }),
});

describe('loadSession', () => {
  it('is signed out without a token, without calling the API', async () => {
    await expect(
      loadSession({ getToken: async () => null }, api(new Error('should not be called'))),
    ).resolves.toEqual({
      status: 'signed-out',
    });
  });

  it('is signed in, heading to onboarding, for a new learner', async () => {
    await expect(loadSession({ getToken: async () => 't' }, api(me))).resolves.toEqual({
      status: 'signed-in',
      me,
      step: 'onboarding',
    });
  });

  it('treats a rejected token as signed out', async () => {
    await expect(
      loadSession(
        { getToken: async () => 'expired' },
        api(new ApiError('Sign in to continue.', 401)),
      ),
    ).resolves.toEqual({ status: 'signed-out' });
  });

  it('passes other failures on', async () => {
    await expect(
      loadSession({ getToken: async () => 't' }, api(new ApiError('Down', 503))),
    ).rejects.toThrow('Down');
  });
});

describe('sign-in input helpers', () => {
  it('checks the basic shape of an email', () => {
    expect(looksLikeEmail(' ana@example.com ')).toBe(true);
    expect(looksLikeEmail('ana@example')).toBe(false);
    expect(looksLikeEmail('ana example.com')).toBe(false);
  });

  it('keeps only the six digits of a code', () => {
    expect(normalizeCode('123 456')).toBe('123456');
    expect(normalizeCode('12-34-567')).toBe('123456');
  });
});
