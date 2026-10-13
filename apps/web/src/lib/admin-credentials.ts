import {
  ADMIN_SESSION_HOURS,
  adminAccount,
  createAdminSession,
  createStaffSession,
  isAdminLogin,
  verifyAdminSession,
  verifyStaffSession,
} from '@oathly/api/admin-session';
import { deriveKey } from '@oathly/api/totp';

// Sessions for the reviewers' area (/admin). Staff sign in with their own
// account, which must hold a staff role, and a code from their authenticator;
// that earns a signed session kept in a cookie. The rules are in @oathly/api
// (admin-session.ts, totp.ts, staff.ts); this reads the environment.
//
// The keys that sign sessions and seal authenticator secrets are made from
// ADMIN_SECRET, or from the sign-in service's cookie secret when that is not
// set. Changing it signs staff out and leaves their authenticators unreadable:
// each is then reset from the command line (pnpm content staff-reset-2fa) and
// set up again. With neither, the admin area does not exist.

export const ADMIN_SESSION_COOKIE = 'oathly_admin';

const secret = () => process.env.ADMIN_SECRET || process.env.NEON_AUTH_COOKIE_SECRET || '';

export function isAdminConfigured(): boolean {
  return secret().length >= 32;
}

const keys = new Map<string, Buffer>();
function key(purpose: 'session' | 'second-factor'): Buffer {
  const name = `${purpose}:${secret()}`;
  let made = keys.get(name);
  if (!made) {
    made = deriveKey(secret(), purpose);
    keys.set(name, made);
  }
  return made;
}

/** The key authenticator secrets are sealed with in the database. */
export const secondFactorKey = () => key('second-factor');

/** A session for a staff member whose code has just been accepted. */
export const staffSessionFor = (userId: string) => createStaffSession(key('session'), userId);

// The shared account that came before: ADMIN_USERNAME and ADMIN_PASSWORD. It
// only ever works while no admin has an authenticator (lib/admin.ts,
// sharedAccountOpen), which is how the first admin gets in to set theirs up.
const sharedAccount = () => adminAccount(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);

export const isSharedAccountSet = () => sharedAccount() !== null;

/** A session for the shared account if these are its username and password, or null. */
export function signInShared(username: string, password: string): string | null {
  const account = sharedAccount();
  return account && isAdminLogin(account, username, password) ? createAdminSession(account) : null;
}

/** Whose session a cookie holds, if it is a real one that has not run out. */
export type AdminCookie =
  { kind: 'staff'; userId: string; startedAt: Date } | { kind: 'shared'; username: string };

export function readAdminCookie(value: string | null | undefined): AdminCookie | null {
  if (!value || !isAdminConfigured()) return null;
  const staff = verifyStaffSession(key('session'), value);
  if (staff) return { kind: 'staff', ...staff };
  const username = verifyAdminSession(sharedAccount(), value);
  return username ? { kind: 'shared', username } : null;
}

/** How the session cookie is set: readable by the server only, and only under /admin. */
export const adminCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/admin',
  maxAge: ADMIN_SESSION_HOURS * 60 * 60,
} as const;
