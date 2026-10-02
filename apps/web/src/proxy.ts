import { NextResponse, type NextRequest } from 'next/server';

import { isAdminConfigured, verifyBasicAuth } from './lib/admin-credentials';

// Guards /admin. Pages and Server Actions check again with requireReviewer().
export function proxy(request: NextRequest) {
  if (!isAdminConfigured()) return new NextResponse('Not found', { status: 404 });
  if (verifyBasicAuth(request.headers.get('authorization'))) return NextResponse.next();
  return new NextResponse('Sign in to review content.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Oathly admin", charset="UTF-8"' },
  });
}

export const config = { matcher: ['/admin', '/admin/:path*'] };
