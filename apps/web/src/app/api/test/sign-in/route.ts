import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import {
  isTestSignInEnabled,
  TEST_SESSION_COOKIE,
  testSecretMatches,
  testSessionValue,
} from '@/lib/test-sign-in';

// GET /api/test/sign-in?user=<name>&secret=<TEST_SIGN_IN_SECRET>
// Development servers only; see lib/test-sign-in.ts.
export async function GET(request: Request) {
  if (!isTestSignInEnabled()) notFound();
  const url = new URL(request.url);
  if (!testSecretMatches(url.searchParams.get('secret'))) notFound();
  const value = testSessionValue(url.searchParams.get('user') ?? '');
  if (!value)
    return Response.json(
      { error: 'user must be lowercase letters, digits and hyphens' },
      { status: 400 },
    );
  (await cookies()).set(TEST_SESSION_COOKIE, value, { httpOnly: true, sameSite: 'lax', path: '/' });
  return Response.redirect(new URL('/welcome', url), 303);
}
