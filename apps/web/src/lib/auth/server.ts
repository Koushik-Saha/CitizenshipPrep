import { createNeonAuth } from '@neondatabase/auth/next/server';

// Neon Auth (managed Better Auth). Created on first use so that builds and
// pages that never touch auth work without the variables set.

type NeonAuth = ReturnType<typeof createNeonAuth>;

const globalForAuth = globalThis as typeof globalThis & { oathlyAuth?: NeonAuth };

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEON_AUTH_BASE_URL && (process.env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) >= 32,
  );
}

export function getAuth(): NeonAuth {
  if (!isAuthConfigured()) {
    throw new Error(
      'Sign-in is not configured. Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET (32+ characters) in .env.local.',
    );
  }
  globalForAuth.oathlyAuth ??= createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
  });
  return globalForAuth.oathlyAuth;
}
