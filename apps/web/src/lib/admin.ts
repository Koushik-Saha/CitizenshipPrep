import {
  hasEnrolledAdmin,
  recordAdminAction,
  staffMember,
  type StaffRole,
} from '@oathly/api/server';
import { isStaffSessionCurrent } from '@oathly/api/admin-session';
import { ensureReviewer, type Reviewer } from '@oathly/content/review';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ADMIN_SESSION_COOKIE, isSharedAccountSet, readAdminCookie } from './admin-credentials';
import { getDb } from './db';
import { reportError } from './monitoring';
import { currentUser } from './user';

export { getDb };

/** Someone allowed in the reviewers' area, for this request. */
export interface Staff extends Reviewer {
  role: StaffRole;
  /** Signed in with the shared account that came before, not their own. */
  shared: boolean;
}

const globalForAdmin = globalThis as typeof globalThis & {
  oathlyReviewers?: Set<string>;
  oathlySharedClosed?: boolean;
};

/**
 * Whether the shared account (ADMIN_USERNAME and ADMIN_PASSWORD) may still be
 * used. It exists to let the first admin in: once any admin has an
 * authenticator in use, it is closed for good, whatever the environment says.
 */
export async function sharedAccountOpen(): Promise<boolean> {
  if (!isSharedAccountSet() || globalForAdmin.oathlySharedClosed) return false;
  if (await hasEnrolledAdmin(getDb())) {
    // It never reopens, so this server need not ask again.
    globalForAdmin.oathlySharedClosed = true;
    return false;
  }
  return true;
}

/**
 * The staff member making this request, or a redirect away. Three things
 * have to hold, and each is checked here on every page and every action, not
 * only by the proxy: they are signed in with their own account, that account
 * holds a staff role now, and this browser has had a code from their
 * authenticator accepted.
 *
 * `need` is the least role the page takes: reviewers decide on content and
 * moderate; everything else is for admins.
 */
export async function requireStaff(need: StaffRole = 'reviewer'): Promise<Staff> {
  const cookie = readAdminCookie((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);

  if (cookie?.kind === 'shared') {
    if (!(await sharedAccountOpen())) redirect('/admin/sign-in');
    const staff: Staff = {
      id: `admin:${cookie.username}`,
      displayName: cookie.username,
      role: 'admin',
      shared: true,
    };
    globalForAdmin.oathlyReviewers ??= new Set();
    if (!globalForAdmin.oathlyReviewers.has(staff.id)) {
      await ensureReviewer(getDb(), staff, 'admin');
      globalForAdmin.oathlyReviewers.add(staff.id);
    }
    return staff;
  }

  const user = await currentUser();
  // The sign-in page sends a signed-out visitor on to the site's own sign-in.
  if (!user) redirect('/admin/sign-in');
  const member = await staffMember(getDb(), user.userId);
  // Not staff: there is nothing here for them, and nothing to tell them.
  if (!member) redirect('/');
  // A session from another account's code is nobody's here, and one from
  // before they signed out, or before their authenticator was reset, is over.
  if (
    cookie?.kind !== 'staff' ||
    cookie.userId !== user.userId ||
    !isStaffSessionCurrent(cookie, member)
  ) {
    redirect('/admin/sign-in');
  }
  if (need === 'admin' && member.role !== 'admin') redirect('/admin/content');

  return {
    id: user.userId,
    displayName: member.displayName || user.email || 'Staff',
    role: member.role,
    shared: false,
  };
}

/** For the pages and actions reviewers may use. */
export const requireReviewer = () => requireStaff('reviewer');

/** For the pages and actions only admins may use. */
export const requireAdmin = () => requireStaff('admin');

/**
 * Writes down something a staff member did: who, what, on what. Every action
 * in the admin area calls this once it has happened. Nothing typed into a
 * sign-in form is ever put in `detail`.
 *
 * A record that cannot be written is reported, not thrown: the action has
 * already happened, and failing the page would hide that from the person who
 * did it.
 */
export async function audit(
  staff: { id: string; displayName?: string | null },
  action: string,
  target?: { type: string; id: string } | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    await recordAdminAction(getDb(), {
      actorId: staff.id,
      actorName: staff.displayName,
      action,
      targetType: target?.type,
      targetId: target?.id,
      detail,
    });
  } catch (error) {
    reportError(error, { where: 'admin-audit', action });
  }
}
