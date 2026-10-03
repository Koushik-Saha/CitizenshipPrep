import { NextResponse, type NextRequest } from 'next/server';

import { isAdminConfigured, verifyBasicAuth } from './lib/admin-credentials';
import { getAuth, isAuthConfigured } from './lib/auth/server';
import { TEST_SESSION_COOKIE, verifyTestSession } from './lib/test-sign-in';

// /admin: the interim reviewer sign-in. Pages and Server Actions check again
// with requireReviewer().
function adminGuard(request: NextRequest) {
  if (!isAdminConfigured()) return new NextResponse('Not found', { status: 404 });
  if (verifyBasicAuth(request.headers.get('authorization'))) return NextResponse.next();
  return new NextResponse('Sign in to review content.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Oathly admin", charset="UTF-8"' },
  });
}

// Learner pages: Neon Auth sends signed-out visitors to /sign-in and keeps
// the session fresh. Pages check the session again with requireMe().
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) return adminGuard(request);
  if (verifyTestSession(request.cookies.get(TEST_SESSION_COOKIE)?.value))
    return NextResponse.next();
  if (!isAuthConfigured()) return NextResponse.redirect(new URL('/sign-in', request.url));
  return getAuth().middleware({ loginUrl: '/sign-in' })(request);
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/welcome', '/onboarding', '/study/:path*'],
};
