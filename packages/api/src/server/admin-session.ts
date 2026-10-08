import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// The reviewers' sign-in: one account, defined by a username and a password
// on the server (ADMIN_USERNAME, ADMIN_PASSWORD), and a signed session kept in
// a cookie once they have been given. Pure functions: the web app reads the
// environment and the cookie, and hands both in.

/** The shortest password the admin area will run with. */
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

/** How long a session lasts before the password is asked for again. */
export const ADMIN_SESSION_HOURS = 12;

export interface AdminAccount {
  username: string;
  password: string;
}

/** The account the environment defines, or null: with none, the admin area does not exist. */
export function adminAccount(
  username: string | undefined,
  password: string | undefined,
): AdminAccount | null {
  const name = username?.trim();
  if (!name || !password || password.length < MIN_ADMIN_PASSWORD_LENGTH) return null;
  return { username: name, password };
}

// Comparing hashes keeps the comparison constant-time whatever the lengths.
function sameSecret(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** Whether these are the account's username and password. */
export function isAdminLogin(account: AdminAccount, username: string, password: string): boolean {
  // Both are always compared, so the time taken says nothing about which was wrong.
  const name = sameSecret(username.trim(), account.username);
  const secret = sameSecret(password, account.password);
  return name && secret;
}

// The session is signed with a key made from the password, so changing the
// password signs everyone out.
const sign = (account: AdminAccount, payload: string) =>
  createHmac('sha256', createHash('sha256').update(`oathly-admin:${account.password}`).digest())
    .update(payload)
    .digest('base64url');

/** A session for the account, to keep in a cookie: its expiry and a signature over it. */
export function createAdminSession(account: AdminAccount, now: Date = new Date()): string {
  const expires = now.getTime() + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  const payload = `v1.${expires}`;
  return `${payload}.${sign(account, `${account.username}.${payload}`)}`;
}

/** The username a session belongs to, or null when it is missing, forged or expired. */
export function verifyAdminSession(
  account: AdminAccount | null,
  session: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!account || !session) return null;
  const parts = session.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;
  const expires = Number(parts[1]);
  if (!Number.isSafeInteger(expires) || expires <= now.getTime()) return null;
  const expected = sign(account, `${account.username}.v1.${expires}`);
  return sameSecret(parts[2]!, expected) ? account.username : null;
}

/**
 * Where to go after signing in: the page that was asked for, if it is one of
 * the admin area's own. Anything else (another site, another part of this
 * one) goes to the queue.
 */
export function adminReturnPath(next: string | null | undefined): string {
  const fallback = '/admin/content';
  if (!next || !next.startsWith('/admin/') || next.startsWith('/admin/sign-in')) return fallback;
  // No scheme, no "//host", no backslashes a browser would read as slashes.
  if (/[\\\s]|\/\//.test(next)) return fallback;
  return next;
}
