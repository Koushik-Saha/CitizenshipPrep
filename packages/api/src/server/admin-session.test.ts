import { describe, expect, it } from 'vitest';

import {
  adminAccount,
  adminReturnPath,
  createAdminSession,
  isAdminLogin,
  verifyAdminSession,
} from './admin-session';

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
