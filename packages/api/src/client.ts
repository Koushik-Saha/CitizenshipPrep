import { z } from 'zod';

import { examCountrySchema, meSchema, type ExamCountry, type Me } from './me';
import type { OnboardingInput } from './onboarding';

// Talks to the web app's /api routes on behalf of the mobile app. The web app
// itself calls the server functions directly.

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
  /** The signed-in user's access token, or null when signed out. */
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}

const errorBodySchema = z.object({ error: z.string() });

export function createOathlyApi(options: OathlyApiOptions) {
  const doFetch = options.fetch ?? fetch;

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: RequestInit = {},
  ): Promise<T> {
    const token = await options.getToken();
    if (!token) throw new ApiError('You are signed out.', 401);
    const response = await doFetch(new URL(path, options.baseUrl), {
      ...init,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = errorBodySchema.safeParse(body);
      throw new ApiError(
        parsed.success ? parsed.data.error : `Request failed (${response.status}).`,
        response.status,
      );
    }
    return schema.parse(body);
  }

  return {
    me: (): Promise<Me> => request('/api/me', meSchema),
    countries: (): Promise<ExamCountry[]> => request('/api/countries', z.array(examCountrySchema)),
    saveOnboarding: (input: OnboardingInput): Promise<Me> =>
      request('/api/me/onboarding', meSchema, { method: 'POST', body: JSON.stringify(input) }),
  };
}

export type OathlyApi = ReturnType<typeof createOathlyApi>;
