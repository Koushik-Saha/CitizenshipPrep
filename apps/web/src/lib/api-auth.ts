import { bearerToken, createTokenVerifier, ensureProfile } from '@oathly/api/server';

import { currentUser } from './user';
import { getDb } from './db';

// Who is calling an /api route: the mobile app sends Neon Auth's JWT as a
// Bearer token; the web app sends its session cookie.

let verify: ReturnType<typeof createTokenVerifier> | undefined;

export async function apiUserId(request: Request): Promise<string | null> {
  const token = bearerToken(request.headers.get('authorization'));
  if (token) {
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
