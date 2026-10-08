import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthVanillaAdapter } from '@neondatabase/auth/vanilla/adapters';
import { createOathlyApi } from '@oathly/api/client';

import { apiUrl, neonAuthUrl, testSession } from './env';

// Sign-in on mobile is by emailed code: a magic link would open in the
// browser, not in the app. The session cookie lives in the platform's cookie
// store, and the API is called with the JWT Neon Auth issues for the session.

type Auth = ReturnType<typeof createAuth>;

function createAuth(url: string) {
  return createAuthClient(url, {
    adapter: (authUrl) =>
      BetterAuthVanillaAdapter()(authUrl, {
        // Native requests carry no Origin header; Neon Auth only accepts
        // requests from trusted domains, so present the web app's.
        headers: { origin: apiUrl },
      }),
  });
}

let client: Auth | null = null;
function auth(): Auth {
  if (!neonAuthUrl) throw new Error('Sign-in is not available with a test session.');
  client ??= createAuth(neonAuthUrl);
  return client;
}

/** True when a development test session stands in for signing in. */
export const usesTestSession = testSession !== null;

/**
 * The session's JWT (Neon Auth puts it in `session.token`), or null when
 * signed out. Throws when the session cannot be checked (no connection), so
 * callers can tell "signed out" from "offline".
 */
export async function getToken(): Promise<string | null> {
  if (testSession) return testSession;
  const { data, error } = await auth().getSession();
  if (error) throw new Error(error.message ?? 'Could not reach the sign-in service.');
  return data?.session?.token ?? null;
}

export const api = createOathlyApi({ baseUrl: apiUrl, getToken });

export async function sendSignInCode(email: string): Promise<string | null> {
  const { error } = await auth().emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
  return error ? (error.message ?? 'We could not send a code. Try again.') : null;
}

export async function verifySignInCode(email: string, otp: string): Promise<string | null> {
  const { error } = await auth().signIn.emailOtp({ email, otp });
  return error ? (error.message ?? 'That code did not work. Check it and try again.') : null;
}

/**
 * Removes the sign-in account itself, after the learner's data has been
 * deleted from Oathly. Best effort: if the sign-in service refuses, there is
 * nothing of the learner's study left behind it either way.
 */
export async function deleteSignInAccount(): Promise<void> {
  if (testSession) return;
  try {
    await auth().deleteUser();
  } catch {
    // Signing out follows whatever happened here.
  }
}

export async function signOut(): Promise<void> {
  if (testSession) return;
  await auth().signOut();
}
