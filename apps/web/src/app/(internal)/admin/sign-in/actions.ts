'use server';

import { adminReturnPath } from '@oathly/api/admin-session';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { ADMIN_SESSION_COOKIE, adminCookieOptions, signInAdmin } from '@/lib/admin-credentials';
import { addressOf, rateLimited } from '@/lib/rate-limit';

/**
 * Checks the reviewers' username and password and starts a session. A wrong
 * guess says only that it was wrong, never which part; guesses from one
 * network address are limited.
 */
export async function signIn(form: FormData) {
  const next = adminReturnPath(String(form.get('next') ?? ''));
  const back = (problem: string) =>
    redirect(`/admin/sign-in?problem=${problem}&next=${encodeURIComponent(next)}`);

  const request = new Request('http://admin.invalid', { headers: await headers() });
  if (await rateLimited('adminSignIn', 'address', addressOf(request))) back('wait');

  const session = signInAdmin(
    String(form.get('username') ?? ''),
    String(form.get('password') ?? ''),
  );
  if (!session) back('wrong');

  (await cookies()).set(ADMIN_SESSION_COOKIE, session!, adminCookieOptions);
  redirect(next);
}

export async function signOut() {
  (await cookies()).delete({ name: ADMIN_SESSION_COOKIE, path: adminCookieOptions.path });
  redirect('/admin/sign-in?problem=out');
}
