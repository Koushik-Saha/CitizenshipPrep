import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Sessions for the reviewers' area. Pure functions: the web app reads the
// environment and the cookie, and hands both in.
//
// Staff sign in with their own account, which must hold a staff role, and a
// code from their authenticator (see totp.ts). Once the code is accepted they
// get a staff session: a signed note of who they are and when it runs out.
//
// The first half of this file is the login that came before: one shared
// account defined by ADMIN_USERNAME and ADMIN_PASSWORD. It is kept only to
// let the first admin in to set themselves up, and the web app refuses it
// from the moment any admin has an authenticator (staff.ts,
// hasEnrolledAdmin).

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

// --- Staff sessions -------------------------------------------------------------

const signStaff = (key: Buffer, payload: string) =>
  createHmac('sha256', key).update(payload).digest('base64url');

/**
 * A session for a staff member whose second factor has just been accepted:
 * who they are, when it runs out, and a signature over both.
 */
export function createStaffSession(key: Buffer, userId: string, now: Date = new Date()): string {
  const expires = now.getTime() + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  const payload = `v2.${expires}.${Buffer.from(userId, 'utf8').toString('base64url')}`;
  return `${payload}.${signStaff(key, payload)}`;
}

/** Whose staff session it is, and when their code was accepted. */
export interface StaffSession {
  userId: string;
  startedAt: Date;
}

/**
 * The user a staff session belongs to and when it began, or null when it is
 * missing, forged or expired. The caller still has to check that this is who
 * is signed in, that they still hold a role, and that they have not signed
 * out since it began: a session says a code was accepted, nothing more.
 */
export function verifyStaffSession(
  key: Buffer,
  session: string | null | undefined,
  now: Date = new Date(),
): StaffSession | null {
  if (!session) return null;
  const parts = session.split('.');
  if (parts.length !== 4 || parts[0] !== 'v2') return null;
  const expires = Number(parts[1]);
  if (!Number.isSafeInteger(expires) || expires <= now.getTime()) return null;
  if (!sameSecret(parts[3]!, signStaff(key, parts.slice(0, 3).join('.')))) return null;
  const userId = Buffer.from(parts[2]!, 'base64url').toString('utf8');
  if (!userId) return null;
  return { userId, startedAt: new Date(expires - ADMIN_SESSION_HOURS * 60 * 60 * 1000) };
}

/**
 * Whether a session is still good against what the database says: the
 * account has an authenticator in use, and has not signed out since the
 * session began.
 */
export function isStaffSessionCurrent(
  session: StaffSession,
  state: { secondFactorInUse: boolean; sessionsFrom: Date | null },
): boolean {
  if (!state.secondFactorInUse) return false;
  return state.sessionsFrom === null || session.startedAt >= state.sessionsFrom;
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
