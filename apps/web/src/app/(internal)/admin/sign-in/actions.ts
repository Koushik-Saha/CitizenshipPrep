'use server';

import { adminReturnPath } from '@oathly/api/admin-session';
import { acceptSecondFactor, endStaffSessions, staffMember } from '@oathly/api/server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { audit, sharedAccountOpen } from '@/lib/admin';
import {
  ADMIN_SESSION_COOKIE,
  adminCookieOptions,
  readAdminCookie,
  secondFactorKey,
  signInShared,
  staffSessionFor,
} from '@/lib/admin-credentials';
import { getDb } from '@/lib/db';
import { addressOf, emailKey, rateLimited } from '@/lib/rate-limit';
import { currentUser } from '@/lib/user';

// Getting into the reviewers' area. A staff member is already signed in with
// their own account; what is asked for here is a code from their
// authenticator. Tries are limited twice over, by network address and by the
// account being tried, and every one is written to the record.

const backTo = (next: string) => (problem: string) =>
  redirect(`/admin/sign-in?problem=${problem}&next=${encodeURIComponent(next)}`);

/**
 * Whether this try is one too many: five in fifteen minutes from one network
 * address, and five for one account. Both are counted on every try. If the
 * counters cannot be reached nobody is let in.
 */
async function tooManyTries(account: { kind: 'user' | 'email'; id: string }): Promise<boolean> {
  const request = new Request('http://admin.invalid', { headers: await headers() });
  const byAddress = await rateLimited('adminSignIn', 'address', addressOf(request), {
    failClosed: true,
  });
  const byAccount = await rateLimited('adminSignIn', account.kind, account.id, {
    failClosed: true,
  });
  return byAddress !== null || byAccount !== null;
}

/** The signed-in staff member, or a redirect: signed out to sign in, anyone else away. */
async function staffSigningIn() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?admin=1');
  const member = await staffMember(getDb(), user.userId);
  if (!member) redirect('/');
  return {
    id: user.userId,
    displayName: member.displayName || user.email || 'Staff',
  };
}

async function enterWithCode(form: FormData, confirming: boolean) {
  const next = adminReturnPath(String(form.get('next') ?? ''));
  const back = backTo(next);
  const staff = await staffSigningIn();
  if (await tooManyTries({ kind: 'user', id: staff.id })) {
    await audit(staff, 'sign-in.limited');
    back('wait');
  }
  const accepted = await acceptSecondFactor(
    getDb(),
    secondFactorKey(),
    staff.id,
    String(form.get('code') ?? ''),
    { confirming },
  );
  if (!accepted) {
    await audit(staff, confirming ? 'second-factor.refused' : 'sign-in.refused');
    back('code');
  }
  if (confirming) await audit(staff, 'second-factor.enrolled');
  await audit(staff, 'sign-in.accepted');
  (await cookies()).set(ADMIN_SESSION_COOKIE, staffSessionFor(staff.id), adminCookieOptions);
  redirect(next);
}

/** Checks the code from a staff member's authenticator and starts their session. */
export async function enterCode(form: FormData) {
  await enterWithCode(form, false);
}

/** The first code from a new authenticator: puts it into use, and starts a session. */
export async function confirmAuthenticator(form: FormData) {
  await enterWithCode(form, true);
}

/**
 * The shared account that came before. It works only until an admin has an
 * authenticator in use, which is how the first admin gets in; after that this
 * refuses whatever is typed.
 */
export async function enterSharedAccount(form: FormData) {
  const next = adminReturnPath(String(form.get('next') ?? ''));
  const back = backTo(next);
  if (!(await sharedAccountOpen())) back('closed');

  const username = String(form.get('username') ?? '');
  // Counted under a keyed hash of what was typed, never as itself.
  if (await tooManyTries({ kind: 'email', id: emailKey(`shared:${username}`) })) back('wait');

  const session = signInShared(username, String(form.get('password') ?? ''));
  if (!session) {
    await audit({ id: 'shared-account' }, 'sign-in.refused', null, { shared: true });
    back('wrong');
  }
  const shared = readAdminCookie(session);
  await audit(
    {
      id: `admin:${shared?.kind === 'shared' ? shared.username : 'shared'}`,
      displayName: shared?.kind === 'shared' ? shared.username : 'shared',
    },
    'sign-in.accepted',
    null,
    { shared: true },
  );
  (await cookies()).set(ADMIN_SESSION_COOKIE, session!, adminCookieOptions);
  redirect(next);
}

/**
 * Ends the session in the reviewers' area, in this browser and anywhere a
 * copy of it may be. The account stays signed in to the site.
 */
export async function signOut() {
  const jar = await cookies();
  const cookie = readAdminCookie(jar.get(ADMIN_SESSION_COOKIE)?.value);
  if (cookie) {
    if (cookie.kind === 'staff') await endStaffSessions(getDb(), cookie.userId);
    const id = cookie.kind === 'staff' ? cookie.userId : `admin:${cookie.username}`;
    await audit({ id, displayName: cookie.kind === 'shared' ? cookie.username : null }, 'sign-out');
  }
  jar.delete({ name: ADMIN_SESSION_COOKIE, path: adminCookieOptions.path });
  redirect('/admin/sign-in?problem=out');
}
