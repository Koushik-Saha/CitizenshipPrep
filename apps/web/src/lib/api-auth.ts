import { bearerToken, createTokenVerifier, ensureProfile } from '@oathly/api/server';

import { track } from './analytics';
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
      if (await ensureProfile(getDb(), testUser, null)) {
        track(testUser, 'signup', { platform: 'mobile' });
      }
      return testUser;
    }
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    if (!baseUrl) return null;
    verify ??= createTokenVerifier({ baseUrl });
    const verified = await verify(token);
    if (!verified) return null;
    // The first sight of an account is its signup: here, from the phone app.
    if (await ensureProfile(getDb(), verified.userId, verified.name)) {
      track(verified.userId, 'signup', { platform: 'mobile' });
    }
    return verified.userId;
  }
  // The session cookie. A browser attaches it to requests another site makes
  // too, so a request that changes something must come from this site: a
  // browser says where a request is from (Origin), and one from elsewhere is
  // treated as signed out. Cookies are SameSite=Lax as well; this is the
  // second lock on the same door.
  if (!isSafeMethod(request.method) && isCrossSite(request)) return null;
  return (await currentUser())?.userId ?? null;
}

const isSafeMethod = (method: string) => method === 'GET' || method === 'HEAD';

/** Whether a browser says this request was made by a page on another site. */
export function isCrossSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  // No Origin: not a browser's cross-site request (curl, a server, same-origin GETs).
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
