import { ensureProfile, getMe } from '@oathly/api/server';
import type { Me } from '@oathly/api';
import { localizePath, type UiLocale } from '@oathly/i18n';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { track } from './analytics';
import { getAuth, isAuthConfigured } from './auth/server';
import { getDb } from './db';
import { TEST_SESSION_COOKIE, verifyTestSession } from './test-sign-in';

export interface SignedInUser {
  userId: string;
  email: string | null;
}

/** The signed-in user, or null. Creates their profile on first sight. */
export async function currentUser(): Promise<SignedInUser | null> {
  // Per-request, always: never let a page that depends on the session be
  // prerendered at build time.
  await connection();
  const testUser = verifyTestSession((await cookies()).get(TEST_SESSION_COOKIE)?.value);
  if (testUser) {
    if (await ensureProfile(getDb(), testUser, null))
      track(testUser, 'signup', { platform: 'web' });
    return { userId: testUser, email: null };
  }
  if (!isAuthConfigured()) return null;
  const { data } = await getAuth().getSession();
  const user = data?.user;
  if (!user?.id) return null;
  // The first sight of an account is its signup.
  if (await ensureProfile(getDb(), user.id, user.name || null)) {
    track(user.id, 'signup', { platform: 'web' });
  }
  return { userId: user.id, email: user.email ?? null };
}

/** The signed-in learner with everything the pages need, or a redirect to sign in. */
export async function requireMe(locale: UiLocale): Promise<{ user: SignedInUser; me: Me }> {
  const user = await currentUser();
  if (!user) redirect(localizePath(locale, '/sign-in'));
  const me = await getMe(getDb(), user.userId);
  if (!me) redirect(localizePath(locale, '/sign-in'));
  return { user, me };
}
