import { ApiError, type OathlyApi } from './client';
import { nextStep, type Me } from './me';

// The session state machine a client app runs on: signed out, or signed in
// with the learner's data and where they should be. The web app reaches the
// same decisions on the server with nextStep().

export type SessionState =
  { status: 'signed-out' } | { status: 'signed-in'; me: Me; step: 'onboarding' | 'study' };

export interface SessionAuth {
  /** The current access token, or null when signed out. */
  getToken: () => Promise<string | null>;
}

/** Works out the session from the auth client and the API. An expired session counts as signed out. */
export async function loadSession(auth: SessionAuth, api: OathlyApi): Promise<SessionState> {
  if (!(await auth.getToken())) return { status: 'signed-out' };
  try {
    const me = await api.me();
    return { status: 'signed-in', me, step: nextStep(me) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { status: 'signed-out' };
    throw error;
  }
}

/** Basic shape check before asking the auth service to send a code. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Sign-in codes are six digits; people paste them with spaces. */
export function normalizeCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}
