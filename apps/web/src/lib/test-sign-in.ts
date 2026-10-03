import { createHmac, timingSafeEqual } from 'node:crypto';

// A sign-in for automated browser tests, so they do not depend on a real
// inbox. It exists only on a development server started with
// TEST_SIGN_IN_SECRET set: `next build` sets NODE_ENV to production, which
// switches it off for good.

export const TEST_SESSION_COOKIE = 'oathly_test_session';

function secret(): string | null {
  if (process.env.NODE_ENV !== 'development') return null;
  const value = process.env.TEST_SIGN_IN_SECRET;
  return value && value.length >= 32 ? value : null;
}

export function isTestSignInEnabled(): boolean {
  return secret() !== null;
}

function sign(userId: string, key: string): string {
  return createHmac('sha256', key).update(userId).digest('base64url');
}

/** Cookie value for a test user. Test user ids always start with "test:". */
export function testSessionValue(name: string): string | null {
  const key = secret();
  if (!key || !/^[a-z0-9-]{1,40}$/.test(name)) return null;
  const userId = `test:${name}`;
  return `${userId}.${sign(userId, key)}`;
}

/** The test user a cookie value belongs to, or null. */
export function verifyTestSession(value: string | undefined): string | null {
  const key = secret();
  if (!key || !value) return null;
  const separator = value.lastIndexOf('.');
  const userId = value.slice(0, separator);
  if (separator < 0 || !userId.startsWith('test:')) return null;
  const expected = Buffer.from(sign(userId, key));
  const given = Buffer.from(value.slice(separator + 1));
  return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null;
}

/** Checks the secret a test passes to sign in. */
export function testSecretMatches(given: string | null): boolean {
  const key = secret();
  if (!key || !given) return false;
  const a = Buffer.from(sign('check', key));
  const b = Buffer.from(sign('check', given));
  return timingSafeEqual(a, b);
}
