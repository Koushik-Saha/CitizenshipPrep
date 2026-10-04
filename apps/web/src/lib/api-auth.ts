import { bearerToken, createTokenVerifier, ensureProfile } from '@oathly/api/server';

import { currentUser } from './user';
import { getDb } from './db';
import { verifyTestSession } from './test-sign-in';

// Who is calling an /api route: the mobile app sends Neon Auth's JWT as a
// Bearer token; the web app sends its session cookie.

let verify: ReturnType<typeof createTokenVerifier> | undefined;

export async function apiUserId(request: Request): Promise<string | null> {
  const token = bearerToken(request.headers.get('authorization'));
  if (token) {
    // Development servers with TEST_SIGN_IN_SECRET only: the mobile app's
    // automated tests send a test session instead of a Neon Auth token.
    const testUser = verifyTestSession(token);
    if (testUser) {
      await ensureProfile(getDb(), testUser, null);
      return testUser;
    }
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    if (!baseUrl) return null;
    verify ??= createTokenVerifier({ baseUrl });
    const verified = await verify(token);
    if (!verified) return null;
    await ensureProfile(getDb(), verified.userId, verified.name);
    return verified.userId;
  }
  return (await currentUser())?.userId ?? null;
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
