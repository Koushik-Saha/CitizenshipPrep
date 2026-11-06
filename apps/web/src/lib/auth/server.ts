import { createNeonAuth } from '@neondatabase/auth/next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { headers } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// Who checks the sign-in codes and holds the sessions: Neon Auth (managed
// Better Auth) by default, or this app itself (self-hosted Better Auth, see
// ./self-hosted.ts) when AUTH_PROVIDER=self-hosted. Everything that needs
// auth — the /api/auth route, the pages' session check, the proxy's guard —
// goes through getAuth(), so the swap is decided in this one file.
//
// The self-hosted implementation is imported lazily: it carries the database
// driver, which the proxy's runtime cannot load.

export type AuthProvider = 'neon' | 'self-hosted';

export function authProvider(): AuthProvider {
  return process.env.AUTH_PROVIDER === 'self-hosted' ? 'self-hosted' : 'neon';
}

/** The secret the self-hosted auth signs with: its own, or the Neon cookie secret it succeeds. */
function selfHostedSecret(): string | undefined {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.NEON_AUTH_COOKIE_SECRET;
  return secret && secret.length >= 32 ? secret : undefined;
}

export interface AuthSessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
}

interface RouteHandlers {
  GET: (request: Request, context: unknown) => Promise<Response>;
  POST: (request: Request, context: unknown) => Promise<Response>;
}

export interface AuthService {
  handler(): RouteHandlers;
  getSession(): Promise<{ data: { user: AuthSessionUser } | null }>;
  middleware(options: { loginUrl: string }): (request: NextRequest) => Promise<NextResponse>;
}

export function isAuthConfigured(): boolean {
  if (authProvider() === 'self-hosted') {
    return Boolean(process.env.DATABASE_URL && process.env.SITE_URL && selfHostedSecret());
  }
  return Boolean(
    process.env.NEON_AUTH_BASE_URL && (process.env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) >= 32,
  );
}

function notConfigured(): Error {
  return authProvider() === 'self-hosted'
    ? new Error(
        'Sign-in is not configured. Set DATABASE_URL, SITE_URL and BETTER_AUTH_SECRET (32+ characters) in .env.local.',
      )
    : new Error(
        'Sign-in is not configured. Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET (32+ characters) in .env.local.',
      );
}

// --- Neon Auth (the default) ---

type NeonAuth = ReturnType<typeof createNeonAuth>;

const globalForAuth = globalThis as typeof globalThis & { oathlyAuth?: NeonAuth };

function getNeonAuth(): NeonAuth {
  if (!isAuthConfigured()) throw notConfigured();
  globalForAuth.oathlyAuth ??= createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
  });
  return globalForAuth.oathlyAuth;
}

const neonService: AuthService = {
  handler: () => getNeonAuth().handler() as RouteHandlers,
  getSession: () =>
    getNeonAuth().getSession() as Promise<{ data: { user: AuthSessionUser } | null }>,
  middleware: (options) =>
    getNeonAuth().middleware(options) as (request: NextRequest) => Promise<NextResponse>,
};

// --- Self-hosted Better Auth (AUTH_PROVIDER=self-hosted) ---

const selfHostedService: AuthService = {
  handler: () => ({
    GET: async (request) =>
      (await import('./self-hosted')).getSelfHostedHandlers(selfHostedSecret()!).GET(request),
    POST: async (request) =>
      (await import('./self-hosted')).getSelfHostedHandlers(selfHostedSecret()!).POST(request),
  }),
  getSession: async () => {
    const user = await (
      await import('./self-hosted')
    ).getSelfHostedSession(selfHostedSecret()!, await headers());
    return { data: user ? { user } : null };
  },
  // An optimistic guard only: is there a session cookie at all? The pages
  // still check the session properly (requireMe); Neon Auth's middleware
  // validated the session here, this one checks its presence — a stale
  // cookie costs one redirect from the page check, never a wrong admission.
  middleware:
    ({ loginUrl }) =>
    async (request) => {
      if (!getSessionCookie(request)) {
        return NextResponse.redirect(new URL(loginUrl, request.url));
      }
      return NextResponse.next();
    },
};

export function getAuth(): AuthService {
  if (!isAuthConfigured()) throw notConfigured();
  return authProvider() === 'self-hosted' ? selfHostedService : neonService;
}
