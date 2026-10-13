import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  aiRequestsLastDay,
  aiUsageByDay,
  aiUsageByUserLastDay,
  getUserForAdmin,
  listOrganizationsForAdmin,
  listSubscriptionsForAdmin,
  ownersOfStripeCustomers,
  removeSignInAccount,
  searchUsers,
} from './admin-console';

// Runs against the local database (`pnpm db:start`); skipped without one.
const url = process.env.TEST_DATABASE_URL;
// A code no real country uses, and unlike the other test files' codes.
const COUNTRY = 'ZD';
const PRO = 'test:console-pro';
const FREE = 'test:console-free';
const OWNER = 'test:console-owner';
const everyone = [PRO, FREE, OWNER];

describe.skipIf(!url)('what the admin area shows, against the database', () => {
  let pool: pg.Pool;
  let orgId = '';

  const cleanUp = async () => {
    await pool.query(`delete from public.organizations where slug = 'console-test-school'`);
    await pool.query('delete from public.profiles where id = any($1)', [everyone]);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages)
       values ($1, 'Consoleland', true, '{en}')`,
      [COUNTRY],
    );
    await pool.query(
      `insert into public.profiles (id, display_name, created_at) values
         ($1, 'Priya Console', now() - interval '3 days'),
         ($2, 'Farid Console', now() - interval '2 days'),
         ($3, null, now() - interval '1 day')`,
      everyone,
    );
    await pool.query(
      `insert into public.user_countries (user_id, country_code, exam_date)
       values ($1, $2, '2027-01-15')`,
      [PRO, COUNTRY],
    );
    await pool.query(`insert into public.user_roles (user_id, role) values ($1, 'reviewer')`, [
      FREE,
    ]);
    await pool.query(
      `insert into public.subscriptions
         (user_id, plan, status, provider, provider_subscription_id, current_period_end,
          cancel_at_period_end, country_code, created_at)
       values ($1, 'pro_monthly', 'active', 'stripe', 'sub_console_1', now() + interval '20 days',
               true, null, now() - interval '2 hours'),
              ($1, 'country_pass', 'canceled', 'stripe', 'pi_console_1', now() - interval '1 day',
               false, $2, now() - interval '3 hours')`,
      [PRO, COUNTRY],
    );
    await pool.query(
      `insert into public.billing_customers (user_id, stripe_customer_id) values ($1, 'cus_consolepro')`,
      [PRO],
    );
    await pool.query(
      `insert into public.attempts (user_id, country_code, mode, started_at, completed_at,
                                    question_count, correct_count)
       values ($1, $2, 'practice', now() - interval '2 hours', now() - interval '1 hour', 10, 8),
              ($1, $2, 'practice', now() - interval '30 minutes', null, 10, 0)`,
      [PRO, COUNTRY],
    );
    await pool.query(
      `insert into public.ai_usage (user_id, feature, model, input_tokens, output_tokens,
                                    cache_read_tokens, cache_write_tokens, created_at)
       values ($1, 'explanation', 'claude-haiku-4-5', 1000, 200, 50, 10, now() - interval '1 hour'),
              ($1, 'explanation', 'claude-haiku-4-5', 1200, 300, 0, 0, now() - interval '2 hours'),
              ($1, 'tutor', 'claude-haiku-4-5', 800, 400, 0, 0, now() - interval '3 hours'),
              ($2, 'tutor', 'some-other-model', 500, 100, 0, 0, now() - interval '4 hours'),
              ($1, 'tutor', 'claude-haiku-4-5', 999, 999, 0, 0, now() - interval '3 days')`,
      [PRO, FREE],
    );
    const org = await pool.query<{ id: string }>(
      `insert into public.organizations (name, slug, seat_limit, created_by)
       values ('Console Test School', 'console-test-school', 5, $1) returning id`,
      [OWNER],
    );
    orgId = org.rows[0]!.id;
    // Creating an organization makes its creator the owner; add a member.
    await pool.query(
      `insert into public.org_members (organization_id, user_id, role) values ($1, $2, 'member')
       on conflict do nothing`,
      [orgId, PRO],
    );
    await pool.query(
      `insert into public.subscriptions
         (organization_id, plan, status, provider, provider_subscription_id, seats,
          current_period_end)
       values ($1, 'team', 'active', 'stripe', 'sub_console_team', 12, now() + interval '25 days')`,
      [orgId],
    );
    await pool.query(
      `insert into public.org_billing_customers (organization_id, stripe_customer_id)
       values ($1, 'cus_consoleorg')`,
      [orgId],
    );
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('finds accounts by id or by part of a name, with what each holds', async () => {
    const byName = await searchUsers(pool, 'console');
    const mine = byName.filter((user) => everyone.includes(user.id));
    // Newest first; the owner has no name, so a search by name does not find them.
    expect(mine.map((user) => user.id)).toEqual([FREE, PRO]);
    expect(mine[1]).toMatchObject({
      id: PRO,
      displayName: 'Priya Console',
      // The local database has no sign-in service to hold addresses.
      email: null,
      countries: [COUNTRY],
      pro: true,
      passes: 0,
      seats: 1,
      staffRole: null,
    });
    expect(mine[1]!.lastActiveAt).not.toBeNull();
    expect(mine[0]).toMatchObject({ pro: false, staffRole: 'reviewer', lastActiveAt: null });

    expect((await searchUsers(pool, OWNER)).map((user) => user.id)).toEqual([OWNER]);
    expect(await searchUsers(pool, 'nobody-is-called-this')).toEqual([]);
    // Nothing typed: the newest accounts.
    const newest = await searchUsers(pool, '  ', 2);
    expect(newest).toHaveLength(2);
    expect((await searchUsers(pool)).length).toBeGreaterThanOrEqual(3);
  });

  it('shows one account in full', async () => {
    const user = (await getUserForAdmin(pool, PRO))!;
    expect(user.studying).toEqual([
      { countryCode: COUNTRY, examDate: '2027-01-15', since: expect.any(String) },
    ]);
    expect(user.subscriptions.map((held) => [held.plan, held.status])).toEqual([
      ['pro_monthly', 'active'],
      ['country_pass', 'canceled'],
    ]);
    expect(user.organizations).toEqual([
      { id: orgId, name: 'Console Test School', slug: 'console-test-school', role: 'member' },
    ]);
    expect(user.activity).toEqual({
      sessions: 2,
      sessionsFinished: 1,
      answers: 0,
      aiToday: { explanation: 2, tutor: 1 },
      posts: 0,
      comments: 0,
      reports: 0,
    });
    expect(user.recentSessions).toHaveLength(2);
    expect(user.recentSessions[0]).toMatchObject({ finished: false, questions: 10 });
    expect(user.recentSessions[1]).toMatchObject({ finished: true, correct: 8, mode: 'practice' });
    expect(user.stripeCustomerId).toBe('cus_consolepro');

    const owner = (await getUserForAdmin(pool, OWNER))!;
    expect(owner.stripeCustomerId).toBeNull();
    expect(owner.activity.aiToday).toEqual({});
    expect(owner.organizations[0]).toMatchObject({ role: 'owner' });
    expect(await getUserForAdmin(pool, 'test:console-nobody')).toBeNull();
  });

  it('lists subscriptions with whose they are, and narrows by status', async () => {
    const mine = (await listSubscriptionsForAdmin(pool)).filter((held) =>
      held.providerId?.includes('_console_'),
    );
    expect(mine.map((held) => held.providerId).sort()).toEqual([
      'pi_console_1',
      'sub_console_1',
      'sub_console_team',
    ]);
    const pro = mine.find((held) => held.providerId === 'sub_console_1')!;
    expect(pro).toMatchObject({
      plan: 'pro_monthly',
      status: 'active',
      provider: 'stripe',
      cancelAtPeriodEnd: true,
      owner: { kind: 'user', id: PRO, name: 'Priya Console' },
      stripeCustomerId: 'cus_consolepro',
      seats: null,
    });
    expect(pro.currentPeriodEnd).not.toBeNull();
    const team = mine.find((held) => held.providerId === 'sub_console_team')!;
    expect(team).toMatchObject({
      plan: 'team',
      seats: 12,
      owner: { kind: 'organization', id: orgId, name: 'Console Test School' },
      stripeCustomerId: 'cus_consoleorg',
    });
    const pass = mine.find((held) => held.providerId === 'pi_console_1')!;
    expect(pass).toMatchObject({ plan: 'country_pass', countryCode: COUNTRY, status: 'canceled' });

    const canceled = await listSubscriptionsForAdmin(pool, { status: 'canceled' });
    expect(canceled.every((held) => held.status === 'canceled')).toBe(true);
    expect(canceled.map((held) => held.providerId)).toContain('pi_console_1');
    // A status that is not one is no filter.
    expect((await listSubscriptionsForAdmin(pool, { status: 'made-up' })).length).toBeGreaterThan(
      canceled.length,
    );
    expect(await listSubscriptionsForAdmin(pool, { userId: FREE })).toEqual([]);
    expect(await listSubscriptionsForAdmin(pool, {}, 1)).toHaveLength(1);
  });

  it('names the payer behind a Stripe customer', async () => {
    const owners = await ownersOfStripeCustomers(pool, [
      'cus_consolepro',
      'cus_consoleorg',
      'cus_nobodyknown',
    ]);
    expect(owners.get('cus_consolepro')).toEqual({ kind: 'user', id: PRO, name: 'Priya Console' });
    expect(owners.get('cus_consoleorg')).toEqual({
      kind: 'organization',
      id: orgId,
      name: 'Console Test School',
    });
    expect(owners.has('cus_nobodyknown')).toBe(false);
    expect((await ownersOfStripeCustomers(pool, [])).size).toBe(0);
  });

  it('lists organizations with their seats and how many are filled', async () => {
    const school = (await listOrganizationsForAdmin(pool)).find((org) => org.id === orgId)!;
    expect(school).toMatchObject({
      name: 'Console Test School',
      slug: 'console-test-school',
      members: 2,
      invited: 0,
      // What it pays for, not what staff once granted.
      seats: 12,
      subscription: { status: 'active', cancelAtPeriodEnd: false },
      stripeCustomerId: 'cus_consoleorg',
    });
    await pool.query(
      `delete from public.subscriptions where provider_subscription_id = 'sub_console_team'`,
    );
    const granted = (await listOrganizationsForAdmin(pool)).find((org) => org.id === orgId)!;
    expect(granted).toMatchObject({ seats: 5, subscription: null });
    expect(await listOrganizationsForAdmin(pool, 1)).toHaveLength(1);
  });

  it('adds up AI use by day and by learner', async () => {
    const days = await aiUsageByDay(pool, 14);
    const today = new Date().toISOString().slice(0, 10);
    // Newest first.
    expect(days.map((day) => day.day)).toEqual([...days.map((day) => day.day)].sort().reverse());
    const requests = days.reduce((sum, day) => sum + day.requests, 0);
    expect(requests).toBeGreaterThanOrEqual(5);
    const recent = days.filter(
      (day) => day.day >= new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
    );
    expect(recent.reduce((sum, day) => sum + day.requests, 0)).toBeGreaterThanOrEqual(4);
    expect(days.find((day) => day.day <= today)!.tokens.length).toBeGreaterThan(0);
    expect(days.every((day) => day.users >= 1)).toBe(true);
    // One day back only: the request from three days ago is not in it.
    const short = await aiUsageByDay(pool, 1);
    expect(short.every((day) => day.day === today)).toBe(true);
    // A span that is out of range is brought into it rather than refused.
    expect((await aiUsageByDay(pool, 0)).every((day) => day.day === today)).toBe(true);

    expect(await aiRequestsLastDay(pool)).toBeGreaterThanOrEqual(4);

    const users = await aiUsageByUserLastDay(pool);
    const pro = users.find((user) => user.userId === PRO)!;
    expect(pro).toMatchObject({
      displayName: 'Priya Console',
      pro: true,
      requests: { explanation: 2, tutor: 1 },
    });
    // Tokens are added up for each feature and model: 2,200 in and 500 out for explanations.
    expect(pro.tokens).toContainEqual({
      model: 'claude-haiku-4-5',
      input: 2200,
      output: 500,
      cacheRead: 50,
      cacheWrite: 10,
    });
    const free = users.find((user) => user.userId === FREE)!;
    expect(free).toMatchObject({ pro: false, requests: { tutor: 1 } });
    expect(free.tokens[0]!.model).toBe('some-other-model');
    // The heaviest user comes before a lighter one.
    expect(users.findIndex((user) => user.userId === PRO)).toBeLessThan(
      users.findIndex((user) => user.userId === FREE),
    );
    expect(await aiUsageByUserLastDay(pool, 1)).toHaveLength(1);
  });

  it('removes a sign-in account where the sign-in service keeps them', async () => {
    // Not in the local database.
    expect(await removeSignInAccount(pool, PRO)).toBe('unavailable');

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
        `insert into neon_auth."user" (id, email, "emailVerified")
         values ('33333333-3333-4333-8333-333333333333', 'Priya@Example.test', true)`,
      );
      await client.query(
        `insert into public.profiles (id, display_name)
         values ('33333333-3333-4333-8333-333333333333', 'Someone Signed Up')`,
      );
      // With the service's accounts there, a search reaches the address too.
      const found = await searchUsers(client, 'priya@example');
      expect(found.map((user) => user.email)).toEqual(['Priya@Example.test']);
      expect((await getUserForAdmin(client, '33333333-3333-4333-8333-333333333333'))!.email).toBe(
        'Priya@Example.test',
      );

      expect(await removeSignInAccount(client, '33333333-3333-4333-8333-333333333333')).toBe(
        'removed',
      );
      expect(await removeSignInAccount(client, '33333333-3333-4333-8333-333333333333')).toBe(
        'absent',
      );
    } finally {
      await client.query('rollback');
      client.release();
    }
  });
});
