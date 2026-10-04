import type { QueuedAnswer, SyncOutcome } from '@oathly/core';
import * as z from 'zod/mini';

import { examCountrySchema, meSchema, type ExamCountry, type Me } from './me';
import type { OnboardingInput } from './onboarding';
import type { CountryPack, OfflineAttempt } from './pack';
import {
  countryPackSchema,
  dashboardSchema,
  startedSchema,
  studySessionSchema,
  syncOutcomeSchema,
} from './schemas';
import type { Dashboard, SessionResult, StartSessionRequest, StudySession } from './study';

// Talks to the web app's /api routes. The mobile app sends Neon Auth's token;
// the web app's own client components leave `getToken` out and rely on the
// session cookie. Server Components call the server functions directly.

export class ApiError extends Error {
  override readonly name = 'ApiError';
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface OathlyApiOptions {
  /** The web app's origin, e.g. https://oathly.app. */
  baseUrl: string;
  /**
   * The signed-in user's access token, or null when signed out. Leave out in
   * the browser, where the session cookie identifies the learner.
   */
  getToken?: () => Promise<string | null>;
  fetch?: typeof fetch;
}

const errorBodySchema = z.object({ error: z.string() });

export function createOathlyApi(options: OathlyApiOptions) {
  // Looked up per call, so tests and React Native can swap the global.
  const doFetch: typeof fetch = (input, init) => (options.fetch ?? fetch)(input, init);

  async function send(path: string, init: RequestInit): Promise<Response> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (options.getToken) {
      const token = await options.getToken();
      if (!token) throw new ApiError('You are signed out.', 401);
      headers.authorization = `Bearer ${token}`;
    }
    if (init.body) headers['content-type'] = 'application/json';
    const response = await doFetch(new URL(path, options.baseUrl).toString(), {
      ...init,
      headers,
      ...(options.getToken ? {} : { credentials: 'same-origin' as const }),
    });
    if (!response.ok) {
      const parsed = errorBodySchema.safeParse(await response.json().catch(() => null));
      throw new ApiError(
        parsed.success ? parsed.data.error : `Request failed (${response.status}).`,
        response.status,
      );
    }
    return response;
  }

  async function request<T>(
    path: string,
    schema: z.ZodMiniType<T>,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await send(path, init);
    return schema.parse(await response.json().catch(() => null));
  }

  const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
  const id = encodeURIComponent;

  return {
    me: (): Promise<Me> => request('/api/me', meSchema),
    countries: (): Promise<ExamCountry[]> => request('/api/countries', z.array(examCountrySchema)),
    saveOnboarding: (input: OnboardingInput): Promise<Me> =>
      request('/api/me/onboarding', meSchema, post(input)),
    setTimeZone: async (timeZone: string): Promise<void> => {
      await send('/api/me/time-zone', post({ timeZone }));
    },

    dashboard: (): Promise<Dashboard> => request('/api/study/dashboard', dashboardSchema),
    /** Picks the questions on the server and returns the new attempt's id. */
    startSession: (start: StartSessionRequest): Promise<{ attemptId: string }> =>
      request('/api/study/sessions', startedSchema, post(start)),
    session: (attemptId: string): Promise<StudySession> =>
      request(`/api/study/sessions/${id(attemptId)}`, studySessionSchema),
    completeSession: async (attemptId: string, result: SessionResult): Promise<void> => {
      await send(`/api/attempts/${id(attemptId)}/complete`, post(result));
    },

    /** For the offline queue: pass as the `send` argument of syncQueue(). */
    sendAnswers: (answers: QueuedAnswer[]): Promise<SyncOutcome> =>
      request('/api/answers', syncOutcomeSchema, post({ answers })),
    /** Everything needed to study one country with no connection. */
    countryPack: (countryCode: string): Promise<CountryPack> =>
      request(`/api/packs/${id(countryCode)}`, countryPackSchema),
    /** Tells the server about sessions started offline. Safe to repeat. */
    registerOfflineAttempts: async (attempts: OfflineAttempt[]): Promise<void> => {
      await send('/api/study/sessions/offline', post({ attempts }));
    },
  };
}

export type OathlyApi = ReturnType<typeof createOathlyApi>;
