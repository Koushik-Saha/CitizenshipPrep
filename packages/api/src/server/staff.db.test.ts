import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  acceptSecondFactor,
  isSecondFactorReadable,
  endStaffSessions,
  hasEnrolledAdmin,
  listAdminActions,
  recordAdminAction,
  secondFactorState,
  staffMember,
  staffRole,
  startEnrollment,
} from './staff';
import { deriveKey, totpCode, totpStep } from './totp';

// Runs against the local database (`pnpm db:start`); skipped without one.
const url = process.env.TEST_DATABASE_URL;
const RUN = Date.now().toString(36);
const ADMIN = `test:staff-admin-${RUN}`;
const REVIEWER = `test:staff-reviewer-${RUN}`;
const LEARNER = `test:staff-learner-${RUN}`;
const key = deriveKey('a secret the server holds', 'second-factor');
const now = new Date('2026-10-13T09:00:00Z');
const later = (seconds: number) => new Date(now.getTime() + seconds * 1000);

describe.skipIf(!url)('staff, their second factor and the record, against the database', () => {
  let pool: pg.Pool;

  const cleanUp = async () => {
    await pool.query(`delete from public.profiles where id like 'test:staff-%'`);
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    for (const id of [ADMIN, REVIEWER, LEARNER]) {
      await pool.query('insert into public.profiles (id) values ($1)', [id]);
    }
    await pool.query(
      `insert into public.user_roles (user_id, role) values ($1, 'admin'), ($2, 'reviewer')`,
      [ADMIN, REVIEWER],
    );
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('knows who is staff', async () => {
    expect(await staffRole(pool, ADMIN)).toBe('admin');
    expect(await staffRole(pool, REVIEWER)).toBe('reviewer');
    expect(await staffRole(pool, LEARNER)).toBeNull();
    expect(await staffRole(pool, 'test:staff-nobody')).toBeNull();
    await pool.query(`update public.profiles set display_name = 'Ada' where id = $1`, [ADMIN]);
    expect(await staffMember(pool, ADMIN)).toEqual({
      role: 'admin',
      displayName: 'Ada',
      secondFactorInUse: false,
      sessionsFrom: null,
    });
    expect(await staffMember(pool, REVIEWER)).toMatchObject({
      role: 'reviewer',
      displayName: null,
    });
    expect(await staffMember(pool, LEARNER)).toBeNull();
  });

  it('sets up an authenticator: the same secret until the first code is accepted', async () => {
    expect(await secondFactorState(pool, ADMIN)).toBe('none');
    expect(await hasEnrolledAdmin(pool)).toBe(false);

    const secret = (await startEnrollment(pool, key, ADMIN))!;
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(await secondFactorState(pool, ADMIN)).toBe('pending');
    // Reloading the page shows the secret already typed into the phone.
    expect(await startEnrollment(pool, key, ADMIN)).toBe(secret);
    // It is not stored as it is.
    const stored = await pool.query<{ secret_sealed: string }>(
      'select secret_sealed from public.staff_second_factors where user_id = $1',
      [ADMIN],
    );
    expect(stored.rows[0]!.secret_sealed).not.toContain(secret);

    // Not in use yet: it cannot be signed in with, and nobody is enrolled.
    const code = totpCode(secret, totpStep(now));
    expect(await acceptSecondFactor(pool, key, ADMIN, code, { now })).toBe(false);
    expect(await hasEnrolledAdmin(pool)).toBe(false);

    // A wrong code confirms nothing.
    expect(await acceptSecondFactor(pool, key, ADMIN, '000000', { confirming: true, now })).toBe(
      false,
    );
    expect(await secondFactorState(pool, ADMIN)).toBe('pending');

    expect(await acceptSecondFactor(pool, key, ADMIN, code, { confirming: true, now })).toBe(true);
    expect(await secondFactorState(pool, ADMIN)).toBe('confirmed');
    expect(await hasEnrolledAdmin(pool)).toBe(true);

    expect(await staffMember(pool, ADMIN)).toMatchObject({
      secondFactorInUse: true,
      sessionsFrom: null,
    });
    // Signing out says when: sessions from before then are over.
    await endStaffSessions(pool, ADMIN, later(5));
    expect((await staffMember(pool, ADMIN))!.sessionsFrom).toEqual(later(5));
    // Someone with no authenticator has no sessions to end.
    await endStaffSessions(pool, LEARNER);
    expect(await staffMember(pool, LEARNER)).toBeNull();

    // In use: the secret is never shown again, and cannot be confirmed over.
    expect(await startEnrollment(pool, key, ADMIN)).toBeNull();
    const next = totpCode(secret, totpStep(later(30)));
    expect(
      await acceptSecondFactor(pool, key, ADMIN, next, { confirming: true, now: later(30) }),
    ).toBe(false);
  });

  it('accepts a code once, and never an earlier one', async () => {
    const sealed = await pool.query<{ secret_sealed: string }>(
      'select secret_sealed from public.staff_second_factors where user_id = $1',
      [ADMIN],
    );
    const { openSecret } = await import('./totp');
    const secret = openSecret(key, sealed.rows[0]!.secret_sealed)!;
    const at = later(120);
    const code = totpCode(secret, totpStep(at));

    // The code that confirmed the authenticator is spent.
    const first = totpCode(secret, totpStep(now));
    expect(await acceptSecondFactor(pool, key, ADMIN, first, { now })).toBe(false);

    expect(await acceptSecondFactor(pool, key, ADMIN, '123456', { now: at })).toBe(false);
    // Two requests with the same code at the same moment: one gets in.
    const both = await Promise.all([
      acceptSecondFactor(pool, key, ADMIN, code, { now: at }),
      acceptSecondFactor(pool, key, ADMIN, code, { now: at }),
    ]);
    expect(both.filter(Boolean)).toHaveLength(1);
    expect(await acceptSecondFactor(pool, key, ADMIN, code, { now: at })).toBe(false);
    // The next code works.
    const after = later(150);
    expect(
      await acceptSecondFactor(pool, key, ADMIN, totpCode(secret, totpStep(after)), { now: after }),
    ).toBe(true);
  });

  it('accepts nothing from someone with no authenticator, or sealed with another key', async () => {
    expect(await acceptSecondFactor(pool, key, LEARNER, '123456', { now })).toBe(false);
    expect(await acceptSecondFactor(pool, key, LEARNER, '123456', { confirming: true, now })).toBe(
      false,
    );

    // A reviewer's authenticator does not make an admin enrolled.
    const secret = (await startEnrollment(pool, key, REVIEWER))!;
    const otherKey = deriveKey('another secret', 'second-factor');
    const code = totpCode(secret, totpStep(now));
    expect(
      await acceptSecondFactor(pool, otherKey, REVIEWER, code, { confirming: true, now }),
    ).toBe(false);
    // The server can tell that it can no longer read an authenticator.
    expect(await isSecondFactorReadable(pool, key, REVIEWER)).toBe(true);
    expect(await isSecondFactorReadable(pool, otherKey, REVIEWER)).toBe(false);
    expect(await isSecondFactorReadable(pool, key, LEARNER)).toBe(false);
    // The server's key changed (a rotated secret): setting up starts again with a new secret.
    const replaced = (await startEnrollment(pool, otherKey, REVIEWER))!;
    expect(replaced).not.toBe(secret);
    expect(await startEnrollment(pool, otherKey, REVIEWER)).toBe(replaced);
  });

  it('keeps a record that can be read back, newest first, and narrowed', async () => {
    await recordAdminAction(pool, {
      actorId: ADMIN,
      actorName: 'Admin',
      action: 'question.approve',
      targetType: 'question',
      targetId: 'q-1',
      detail: { note: 'checked' },
    });
    await recordAdminAction(pool, { actorId: ADMIN, action: 'sign-in.accepted' });
    await recordAdminAction(pool, {
      actorId: REVIEWER,
      action: 'question.reject',
      targetId: 'q-2',
    });

    const mine = await listAdminActions(pool, { actorId: ADMIN });
    expect(mine.map((entry) => entry.action)).toEqual(['sign-in.accepted', 'question.approve']);
    expect(mine[1]).toMatchObject({
      actorId: ADMIN,
      actorName: 'Admin',
      targetType: 'question',
      targetId: 'q-1',
      detail: { note: 'checked' },
    });
    expect(mine[0]).toMatchObject({ actorName: null, targetType: null, detail: {} });
    expect(new Date(mine[0]!.at).getTime()).toBeGreaterThan(0);

    const decisions = await listAdminActions(pool, { actorId: ADMIN, action: 'question.' });
    expect(decisions.map((entry) => entry.action)).toEqual(['question.approve']);

    // A page at a time: what comes before the last line seen.
    const older = await listAdminActions(pool, { actorId: ADMIN, before: mine[0]!.id });
    expect(older.map((entry) => entry.action)).toEqual(['question.approve']);
    expect(await listAdminActions(pool, { actorId: ADMIN }, 1)).toHaveLength(1);
    // Something that is not an id is no boundary at all.
    expect(await listAdminActions(pool, { actorId: ADMIN, before: 'x; drop' })).toHaveLength(2);

    const everyone = await listAdminActions(pool);
    expect(everyone.length).toBeGreaterThanOrEqual(3);
    expect(everyone[0]!.action).toBe('question.reject');
  });

  it('cannot have a line changed or removed', async () => {
    await expect(
      pool.query(`update public.admin_audit_log set action = 'x' where actor_id = $1`, [ADMIN]),
    ).rejects.toThrow('append-only');
    await expect(
      pool.query('delete from public.admin_audit_log where actor_id = $1', [ADMIN]),
    ).rejects.toThrow('append-only');
  });
});
