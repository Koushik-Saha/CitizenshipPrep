import {
  isUiLocale,
  localizePath,
  negotiateLocale,
  splitLocalePath,
  type UiLocale,
} from '@oathly/i18n';
import { NextResponse, type NextRequest } from 'next/server';

import { isAdminConfigured, verifyBasicAuth } from './lib/admin-credentials';
import { getAuth, isAuthConfigured } from './lib/auth/server';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from './lib/locale-cookie';
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

/** Pages only a signed-in learner sees, without their language prefix. */
const isLearnerPath = (path: string) =>
  path === '/welcome' ||
  path === '/onboarding' ||
  path === '/study' ||
  path.startsWith('/study/') ||
  path === '/org' ||
  path.startsWith('/org/');

// Learner pages: Neon Auth sends signed-out visitors to /sign-in and keeps
// the session fresh. Pages check the session again with requireMe().
async function learnerGuard(request: NextRequest, locale: UiLocale): Promise<NextResponse> {
  if (verifyTestSession(request.cookies.get(TEST_SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }
  const signIn = localizePath(locale, '/sign-in');
  if (!isAuthConfigured()) return NextResponse.redirect(new URL(signIn, request.url));
  return getAuth().middleware({ loginUrl: signIn })(request);
}

const sameUrl = (request: NextRequest, pathname: string) => {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return url;
};

/**
 * Every page has one URL per language: English at the plain path
 * ("/countries"), the others under a prefix ("/es/countries"). The pages
 * themselves all live under app/[locale], so English is rewritten to "/en/…"
 * out of sight.
 *
 * A plain path is English unless the visitor has chosen another language
 * (cookie) or their browser asks for one we have (Accept-Language), in which
 * case they are sent to that language's URL.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Internal, English-only tools.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return adminGuard(request);
  if (pathname === '/brand') return NextResponse.next();

  const { locale: inUrl, path } = splitLocalePath(pathname);
  // "/en/…" is not a public address: one URL per page per language.
  if (inUrl === 'en') return NextResponse.redirect(sameUrl(request, path), 308);

  let locale: UiLocale | null = inUrl;
  if (!locale) {
    const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
    locale =
      chosen && isUiLocale(chosen)
        ? chosen
        : negotiateLocale(request.headers.get('accept-language'));
    if (locale !== 'en') {
      return NextResponse.redirect(sameUrl(request, localizePath(locale, path)));
    }
  }

  const response = isLearnerPath(path) ? await learnerGuard(request, locale) : NextResponse.next();
  // Remember the language of the page being read, so links and redirects
  // without a language in them (an email link, a Server Action) come back in
  // it. English is remembered by the language menu instead: a plain path
  // cannot tell a choice of English from no choice at all.
  if (inUrl && request.cookies.get(LOCALE_COOKIE)?.value !== inUrl) {
    response.cookies.set(LOCALE_COOKIE, inUrl, {
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
  }
  // A prefixed URL already matches app/[locale]; so does anything that is not
  // a plain "carry on" (a redirect to sign in, say).
  if (inUrl || response.headers.get('x-middleware-next') !== '1') return response;

  // English: serve app/en/… at the plain path, keeping whatever the guard set
  // (session cookies, request headers).
  const rewrite = NextResponse.rewrite(sameUrl(request, `/en${path === '/' ? '' : path}`));
  response.headers.forEach((value, name) => {
    if (name === 'x-middleware-next') return;
    if (name === 'set-cookie') rewrite.headers.append(name, value);
    else rewrite.headers.set(name, value);
  });
  return rewrite;
}

export const config = {
  // Pages only: not the API, Next's own files, or anything with a file
  // extension (images, the globe's assets, robots.txt).
  matcher: ['/((?!api/|_next/|.*\\.[\\w]+$).*)'],
};
