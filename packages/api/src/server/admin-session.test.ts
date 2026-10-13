import { describe, expect, it } from 'vitest';

import {
  ADMIN_SESSION_HOURS,
  adminAccount,
  adminReturnPath,
  createAdminSession,
  createStaffSession,
  isAdminLogin,
  isStaffSessionCurrent,
  verifyAdminSession,
  verifyStaffSession,
} from './admin-session';
import { deriveKey } from './totp';

const account = adminAccount('reviewer', 'a-long-enough-password')!;
const now = new Date('2026-10-08T12:00:00Z');

describe('adminAccount', () => {
  it('needs a username and a password of twelve characters or more', () => {
    expect(account).toEqual({ username: 'reviewer', password: 'a-long-enough-password' });
    expect(adminAccount(' reviewer ', 'a-long-enough-password')!.username).toBe('reviewer');
    expect(adminAccount('reviewer', 'short')).toBeNull();
    expect(adminAccount('', 'a-long-enough-password')).toBeNull();
    expect(adminAccount(undefined, undefined)).toBeNull();
  });
});

describe('isAdminLogin', () => {
  it('accepts the account’s username and password, and nothing else', () => {
    expect(isAdminLogin(account, 'reviewer', 'a-long-enough-password')).toBe(true);
    expect(isAdminLogin(account, ' reviewer ', 'a-long-enough-password')).toBe(true);
    expect(isAdminLogin(account, 'reviewer', 'a-long-enough-passwor')).toBe(false);
    expect(isAdminLogin(account, 'Reviewer', 'a-long-enough-password')).toBe(false);
    expect(isAdminLogin(account, 'someone', 'a-long-enough-password')).toBe(false);
    expect(isAdminLogin(account, '', '')).toBe(false);
  });
});

describe('admin sessions', () => {
  const session = createAdminSession(account, now);

  it('name the account they were made for', () => {
    expect(verifyAdminSession(account, session, now)).toBe('reviewer');
  });

  it('last twelve hours', () => {
    const almost = new Date(now.getTime() + 12 * 60 * 60 * 1000 - 1);
    const after = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    expect(verifyAdminSession(account, session, almost)).toBe('reviewer');
    expect(verifyAdminSession(account, session, after)).toBeNull();
  });

  it('cannot be extended or forged', () => {
    const [version, expires, signature] = session.split('.');
    const later = `${version}.${Number(expires) + 60_000}.${signature}`;
    expect(verifyAdminSession(account, later, now)).toBeNull();
    expect(verifyAdminSession(account, `${version}.${expires}.${'A'.repeat(43)}`, now)).toBeNull();
    for (const value of [
      '',
      'v1',
      'v1.x.y',
      `v2.${expires}.${signature}`,
      `${session}.extra`,
      null,
    ]) {
      expect(verifyAdminSession(account, value, now), String(value)).toBeNull();
    }
  });

  it('stop working when the password or the username changes', () => {
    expect(
      verifyAdminSession(adminAccount('reviewer', 'another-long-password'), session, now),
    ).toBeNull();
    expect(
      verifyAdminSession(adminAccount('someone', 'a-long-enough-password'), session, now),
    ).toBeNull();
    expect(verifyAdminSession(null, session, now)).toBeNull();
  });
});

describe('adminReturnPath', () => {
  it('goes back to the admin page that was asked for', () => {
    expect(adminReturnPath('/admin/content?view=translations&country=US')).toBe(
      '/admin/content?view=translations&country=US',
    );
    expect(adminReturnPath('/admin/content/questions/10000000-0000-4000-8000-000000000001')).toBe(
      '/admin/content/questions/10000000-0000-4000-8000-000000000001',
    );
  });

  it('goes to the queue for anything else', () => {
    for (const next of [
      null,
      undefined,
      '',
      '/study',
      '/admin/sign-in',
      '/admin/sign-in?next=/admin/content',
      'https://evil.example/admin/content',
      '//evil.example/admin/',
      '/admin//evil.example',
      '/admin/\\evil.example',
      '/admin/content evil',
      '/administrator',
    ]) {
      expect(adminReturnPath(next), String(next)).toBe('/admin/content');
    }
  });
});

describe('a staff session', () => {
  const key = deriveKey('a secret the server holds', 'session');
  const session = createStaffSession(key, 'user-1234', now);

  it('says who it belongs to until it runs out', () => {
    expect(verifyStaffSession(key, session, now)).toEqual({ userId: 'user-1234', startedAt: now });
    const lastMinute = new Date(now.getTime() + ADMIN_SESSION_HOURS * 3_600_000 - 60_000);
    expect(verifyStaffSession(key, session, lastMinute)!.userId).toBe('user-1234');
    const after = new Date(now.getTime() + ADMIN_SESSION_HOURS * 3_600_000);
    expect(verifyStaffSession(key, session, after)).toBeNull();
  });

  it('carries any user id, whatever is in it', () => {
    const id = 'test:someone.with/odd=characters';
    expect(verifyStaffSession(key, createStaffSession(key, id, now), now)!.userId).toBe(id);
  });

  it('is refused when missing, forged or altered', () => {
    expect(verifyStaffSession(key, null, now)).toBeNull();
    expect(verifyStaffSession(key, '', now)).toBeNull();
    expect(verifyStaffSession(key, 'v2.1.2', now)).toBeNull();
    // Signed with another key.
    const other = deriveKey('another secret', 'session');
    expect(verifyStaffSession(other, session, now)).toBeNull();
    // Someone else's id put in.
    const [version, expires, , signature] = session.split('.');
    const forged = [version, expires, Buffer.from('user-9999').toString('base64url'), signature];
    expect(verifyStaffSession(key, forged.join('.'), now)).toBeNull();
    // The expiry pushed out.
    const later = [version, String(Number(expires) + 1_000_000), session.split('.')[2], signature];
    expect(verifyStaffSession(key, later.join('.'), now)).toBeNull();
    expect(
      verifyStaffSession(key, `v2.soon.${session.split('.')[2]}.${signature}`, now),
    ).toBeNull();
    // The shared account's kind of session is not a staff session.
    expect(verifyStaffSession(key, createAdminSession(account, now), now)).toBeNull();
    // And a session for nobody is nobody's.
    expect(verifyStaffSession(key, createStaffSession(key, '', now), now)).toBeNull();
  });

  it('is over once they sign out, or their authenticator is taken away', () => {
    const held = verifyStaffSession(key, session, now)!;
    const inUse = { secondFactorInUse: true, sessionsFrom: null };
    expect(isStaffSessionCurrent(held, inUse)).toBe(true);
    // Signed out a minute after it began: this session, and any copy of it, is over.
    const signedOut = new Date(now.getTime() + 60_000);
    expect(isStaffSessionCurrent(held, { ...inUse, sessionsFrom: signedOut })).toBe(false);
    // A session begun after signing out is a new one.
    const again = verifyStaffSession(
      key,
      createStaffSession(key, 'user-1234', new Date(signedOut.getTime() + 1)),
      signedOut,
    )!;
    expect(isStaffSessionCurrent(again, { ...inUse, sessionsFrom: signedOut })).toBe(true);
    expect(isStaffSessionCurrent(held, { ...inUse, sessionsFrom: now })).toBe(true);
    // The authenticator was reset: nothing earned with it counts.
    expect(isStaffSessionCurrent(held, { secondFactorInUse: false, sessionsFrom: null })).toBe(
      false,
    );
  });
});
