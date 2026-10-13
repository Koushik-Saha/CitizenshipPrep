import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  findAccount,
  grantStaffRole,
  listStaff,
  resetSecondFactor,
  revokeStaffRole,
  StaffError,
} from './staff';

// Runs against the local database (`pnpm db:start`); skipped without one.
const url = process.env.TEST_DATABASE_URL;
const RUN = Date.now().toString(36);
const ONE = `test:cli-staff-one-${RUN}`;
const TWO = `test:cli-staff-two-${RUN}`;

describe.skipIf(!url)('granting and taking away staff roles, against the database', () => {
  let pool: pg.Pool;

  const cleanUp = () => pool.query(`delete from public.profiles where id like 'test:cli-staff-%'`);
  const mine = async () =>
    (await listStaff(pool)).filter((member) => member.userId.startsWith('test:cli-staff-'));

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('finds an account by its id, and says why it cannot by anything else', async () => {
    expect(await findAccount(pool, { userId: ONE })).toEqual({ userId: ONE, email: null });
    await expect(findAccount(pool, {})).rejects.toThrow(StaffError);
    await expect(findAccount(pool, { email: '  ' })).rejects.toThrow('Say who');
    // The local database has no sign-in service's tables to look an address up in.
    await expect(findAccount(pool, { email: 'someone@example.test' })).rejects.toThrow(
      /--user <id>|Nobody has signed up/,
    );
  });

  it('finds an account by a verified email address, where the sign-in service keeps them', async () => {
    // The sign-in service's table, made for this test only: everything here is rolled back.
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('create schema if not exists neon_auth');
      await client.query(
        `create table if not exists neon_auth."user"
           (id uuid primary key, email text not null, "emailVerified" boolean not null)`,
      );
      await client.query(
        `insert into neon_auth."user" (id, email, "emailVerified") values
           ('11111111-1111-4111-8111-111111111111', 'Maria@Example.test', true),
           ('22222222-2222-4222-8222-222222222222', 'unverified@example.test', false)`,
      );
      expect(await findAccount(client, { email: ' maria@example.TEST ' })).toEqual({
        userId: '11111111-1111-4111-8111-111111111111',
        email: 'Maria@Example.test',
      });
      await expect(findAccount(client, { email: 'unverified@example.test' })).rejects.toThrow(
        'has not been verified',
      );
      await expect(findAccount(client, { email: 'nobody@example.test' })).rejects.toThrow(
        'Nobody has signed up',
      );
    } finally {
      await client.query('rollback');
      client.release();
    }
  });

  it('grants a role to an account, even one that has not opened the app yet', async () => {
    await grantStaffRole(pool, ONE, 'reviewer');
    await grantStaffRole(pool, TWO, 'admin');
    expect((await mine()).map((member) => [member.userId, member.role])).toEqual([
      [TWO, 'admin'],
      [ONE, 'reviewer'],
    ]);
    // Granting again changes the role rather than failing.
    await grantStaffRole(pool, ONE, 'admin');
    expect((await mine()).find((member) => member.userId === ONE)!.role).toBe('admin');
    await expect(grantStaffRole(pool, ONE, 'owner' as 'admin')).rejects.toThrow('--role');
  });

  it('shows where each one is with their authenticator, and forgets one on request', async () => {
    const factor = async (id: string) =>
      (await mine()).find((member) => member.userId === id)!.secondFactor;
    expect(await factor(ONE)).toBe('none');
    await pool.query(
      `insert into public.staff_second_factors (user_id, secret_sealed)
       values ($1, 'v1.sealed-for-the-test-000')`,
      [ONE],
    );
    expect(await factor(ONE)).toBe('pending');
    await pool.query(
      'update public.staff_second_factors set confirmed_at = now() where user_id = $1',
      [ONE],
    );
    expect(await factor(ONE)).toBe('confirmed');

    expect(await resetSecondFactor(pool, ONE)).toBe(true);
    expect(await resetSecondFactor(pool, ONE)).toBe(false);
    expect(await factor(ONE)).toBe('none');
    // Still staff: only the authenticator went.
    expect((await mine()).map((member) => member.userId)).toContain(ONE);
  });

  it('takes a role away, and the authenticator with it', async () => {
    await pool.query(
      `insert into public.staff_second_factors (user_id, secret_sealed, confirmed_at)
       values ($1, 'v1.sealed-for-the-test-000', now())`,
      [TWO],
    );
    expect(await revokeStaffRole(pool, TWO)).toBe(true);
    expect(await revokeStaffRole(pool, TWO)).toBe(false);
    expect((await mine()).map((member) => member.userId)).toEqual([ONE]);
    const left = await pool.query('select 1 from public.staff_second_factors where user_id = $1', [
      TWO,
    ]);
    expect(left.rowCount).toBe(0);
  });
});
