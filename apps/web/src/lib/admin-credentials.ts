import {
  adminAccount,
  createAdminSession,
  isAdminLogin,
  verifyAdminSession,
  ADMIN_SESSION_HOURS,
} from '@oathly/api/admin-session';

// Sign-in for the reviewers' area: one account, defined by ADMIN_USERNAME and
// ADMIN_PASSWORD on the server, entered on /admin/sign-in and remembered in a
// signed cookie. With either variable unset the admin area does not exist.
// The rules are in @oathly/api (admin-session.ts); this reads the environment.

export const ADMIN_SESSION_COOKIE = 'oathly_admin';

const account = () => adminAccount(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);

export function isAdminConfigured(): boolean {
  return account() !== null;
}

/** The reviewer a session cookie belongs to, or null. */
export function verifyAdminCookie(value: string | null | undefined): string | null {
  return verifyAdminSession(account(), value);
}

/** A new session if these are the account's username and password, or null. */
export function signInAdmin(username: string, password: string): string | null {
  const admin = account();
  return admin && isAdminLogin(admin, username, password) ? createAdminSession(admin) : null;
}

/** How the session cookie is set: readable by the server only, and only under /admin. */
export const adminCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/admin',
  maxAge: ADMIN_SESSION_HOURS * 60 * 60,
} as const;
