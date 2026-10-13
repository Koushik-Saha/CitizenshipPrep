import type { AiTokens } from '@oathly/core';
import type pg from 'pg';

// What the admin area shows about the service itself: who has an account,
// what they hold and pay for, the organizations, and what the AI is costing.
// Read by admins only (the pages check); none of this is served to learners.

type Db = Pick<pg.Pool, 'query'>;

const PRO_IN_FORCE = `s.plan in ('pro_monthly', 'pro_yearly')
  and s.status in ('active', 'trialing', 'past_due')
  and (s.current_period_end is null or s.current_period_end > now())`;

/**
 * Whether this database holds the sign-in service's accounts, which is where
 * email addresses are. A local database does not; the pages then manage
 * without addresses.
 */
async function hasSignInAccounts(db: Db): Promise<boolean> {
  const { rows } = await db.query<{ present: boolean }>(
    `select to_regclass('neon_auth."user"') is not null as present`,
  );
  return rows[0]!.present;
}

// --- Users ---------------------------------------------------------------------

export interface AdminUserRow {
  id: string;
  displayName: string | null;
  email: string | null;
  joinedAt: string;
  countries: string[];
  /** What they hold: Pro, Country Passes, or neither. */
  pro: boolean;
  passes: number;
  /** A seat in an organization. */
  seats: number;
  staffRole: 'reviewer' | 'admin' | null;
  /** When they last started a study session. */
  lastActiveAt: string | null;
}

export const ADMIN_USERS_PAGE_SIZE = 50;

/**
 * Accounts, newest first. `search` narrows by the whole of an id, or by part
 * of a name or an email address; empty lists the newest.
 */
export async function searchUsers(
  db: Db,
  search = '',
  limit = ADMIN_USERS_PAGE_SIZE,
): Promise<AdminUserRow[]> {
  const withEmail = await hasSignInAccounts(db);
  const term = search.trim().slice(0, 200);
  const { rows } = await db.query<{
    id: string;
    display_name: string | null;
    email: string | null;
    created_at: Date;
    countries: string[] | null;
    pro: boolean;
    passes: string;
    seats: string;
    role: AdminUserRow['staffRole'];
    last_active: Date | null;
  }>(
    `select p.id, p.display_name, p.created_at, r.role,
            ${withEmail ? 'u.email' : 'null::text as email'},
            (select array_agg(uc.country_code order by uc.created_at)
             from public.user_countries uc where uc.user_id = p.id) as countries,
            exists (select 1 from public.subscriptions s
                    where s.user_id = p.id and ${PRO_IN_FORCE}) as pro,
            (select count(*) from public.subscriptions s
             where s.user_id = p.id and s.plan = 'country_pass' and s.status = 'active') as passes,
            (select count(*) from public.org_members m where m.user_id = p.id) as seats,
            (select max(a.started_at) from public.attempts a where a.user_id = p.id) as last_active
     from public.profiles p
     left join public.user_roles r on r.user_id = p.id
     ${withEmail ? 'left join neon_auth."user" u on u.id::text = p.id' : ''}
     where $1 = ''
        or p.id = $1
        or position(lower($1) in lower(coalesce(p.display_name, ''))) > 0
        ${withEmail ? "or position(lower($1) in lower(coalesce(u.email, ''))) > 0" : ''}
     order by p.created_at desc, p.id
     limit $2`,
    [term, Math.min(Math.max(limit, 1), 200)],
  );
  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    joinedAt: row.created_at.toISOString(),
    countries: row.countries ?? [],
    pro: row.pro,
    passes: Number(row.passes),
    seats: Number(row.seats),
    staffRole: row.role,
    lastActiveAt: row.last_active?.toISOString() ?? null,
  }));
}

export interface AdminUserDetail extends AdminUserRow {
  studying: { countryCode: string; examDate: string | null; since: string }[];
  subscriptions: AdminSubscription[];
  organizations: { id: string; name: string; slug: string; role: string }[];
  activity: {
    sessions: number;
    sessionsFinished: number;
    answers: number;
    /** AI requests in the last 24 hours, by feature. */
    aiToday: Record<string, number>;
    posts: number;
    comments: number;
    reports: number;
  };
  recentSessions: {
    id: string;
    countryCode: string;
    mode: string;
    startedAt: string;
    finished: boolean;
    correct: number;
    questions: number;
  }[];
  stripeCustomerId: string | null;
}

/** One account, with what an admin needs to answer a question about it. Null if there is none. */
export async function getUserForAdmin(db: Db, userId: string): Promise<AdminUserDetail | null> {
  const [found] = (await searchUsers(db, userId, 5)).filter((row) => row.id === userId);
  if (!found) return null;
  const [studying, subscriptions, organizations, counts, ai, sessions, customer] =
    await Promise.all([
      db.query<{ country_code: string; exam_date: string | null; created_at: Date }>(
        `select country_code, exam_date::text, created_at from public.user_countries
         where user_id = $1 order by created_at`,
        [userId],
      ),
      listSubscriptionsForAdmin(db, { userId }),
      db.query<{ id: string; name: string; slug: string; role: string }>(
        `select o.id, o.name, o.slug, m.role::text from public.org_members m
         join public.organizations o on o.id = m.organization_id
         where m.user_id = $1 order by o.name`,
        [userId],
      ),
      db.query<
        Record<'sessions' | 'finished' | 'answers' | 'posts' | 'comments' | 'reports', string>
      >(
        `select (select count(*) from public.attempts where user_id = $1) as sessions,
                (select count(*) from public.attempts
                 where user_id = $1 and completed_at is not null) as finished,
                (select count(*) from public.answer_events where user_id = $1) as answers,
                (select count(*) from public.community_posts where author_id = $1) as posts,
                (select count(*) from public.community_comments where author_id = $1) as comments,
                (select count(*) from public.content_flags where user_id = $1) as reports`,
        [userId],
      ),
      db.query<{ feature: string; n: string }>(
        `select feature::text, count(*) as n from public.ai_usage
         where user_id = $1 and created_at > now() - interval '24 hours'
         group by feature`,
        [userId],
      ),
      db.query<{
        id: string;
        country_code: string;
        mode: string;
        started_at: Date;
        completed_at: Date | null;
        correct_count: number;
        question_count: number;
      }>(
        `select id, country_code, mode::text, started_at, completed_at, correct_count, question_count
         from public.attempts where user_id = $1 order by started_at desc limit 10`,
        [userId],
      ),
      db.query<{ stripe_customer_id: string }>(
        'select stripe_customer_id from public.billing_customers where user_id = $1',
        [userId],
      ),
    ]);
  const count = counts.rows[0]!;
  return {
    ...found,
    studying: studying.rows.map((row) => ({
      countryCode: row.country_code,
      examDate: row.exam_date,
      since: row.created_at.toISOString(),
    })),
    subscriptions,
    organizations: organizations.rows,
    activity: {
      sessions: Number(count.sessions),
      sessionsFinished: Number(count.finished),
      answers: Number(count.answers),
      aiToday: Object.fromEntries(ai.rows.map((row) => [row.feature, Number(row.n)])),
      posts: Number(count.posts),
      comments: Number(count.comments),
      reports: Number(count.reports),
    },
    recentSessions: sessions.rows.map((row) => ({
      id: row.id,
      countryCode: row.country_code,
      mode: row.mode,
      startedAt: row.started_at.toISOString(),
      finished: row.completed_at !== null,
      correct: row.correct_count,
      questions: row.question_count,
    })),
    stripeCustomerId: customer.rows[0]?.stripe_customer_id ?? null,
  };
}

/**
 * Removes an account from the sign-in service, after its data has been
 * deleted: the address it signed in with, and its sessions. "absent" when it
 * was already gone, "unavailable" where this database does not hold the
 * sign-in service's accounts.
 */
export async function removeSignInAccount(
  db: Db,
  userId: string,
): Promise<'removed' | 'absent' | 'unavailable'> {
  if (!(await hasSignInAccounts(db))) return 'unavailable';
  const removed = await db.query('delete from neon_auth."user" where id::text = $1', [userId]);
  return removed.rowCount ? 'removed' : 'absent';
}

// --- Subscriptions -------------------------------------------------------------

export interface AdminSubscription {
  id: string;
  plan: string;
  status: string;
  provider: string;
  /** The provider's own id for it: a Stripe subscription or payment, a store transaction. */
  providerId: string | null;
  countryCode: string | null;
  seats: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  /** Whose it is: a learner, or an organization. */
  owner:
    | { kind: 'user'; id: string; name: string | null }
    | { kind: 'organization'; id: string; name: string };
  stripeCustomerId: string | null;
}

export const subscriptionStatuses = ['trialing', 'active', 'past_due', 'canceled', 'expired'];

/** Subscriptions and one-off purchases, newest first, optionally of one status or one learner. */
export async function listSubscriptionsForAdmin(
  db: Db,
  filters: { status?: string | null; userId?: string | null } = {},
  limit = 100,
): Promise<AdminSubscription[]> {
  const status = subscriptionStatuses.includes(filters.status ?? '') ? filters.status : null;
  const { rows } = await db.query<{
    id: string;
    plan: string;
    status: string;
    provider: string;
    provider_subscription_id: string | null;
    country_code: string | null;
    seats: number | null;
    current_period_end: Date | null;
    cancel_at_period_end: boolean;
    created_at: Date;
    user_id: string | null;
    display_name: string | null;
    organization_id: string | null;
    organization_name: string | null;
    customer: string | null;
  }>(
    `select s.id, s.plan, s.status::text, s.provider, s.provider_subscription_id, s.country_code,
            s.seats, s.current_period_end, s.cancel_at_period_end, s.created_at,
            s.user_id, p.display_name, s.organization_id, o.name as organization_name,
            coalesce(bc.stripe_customer_id, oc.stripe_customer_id) as customer
     from public.subscriptions s
     left join public.profiles p on p.id = s.user_id
     left join public.organizations o on o.id = s.organization_id
     left join public.billing_customers bc on bc.user_id = s.user_id
     left join public.org_billing_customers oc on oc.organization_id = s.organization_id
     where ($1::text is null or s.status::text = $1)
       and ($2::text is null or s.user_id = $2)
     order by s.created_at desc, s.id
     limit $3`,
    [status ?? null, filters.userId ?? null, Math.min(Math.max(limit, 1), 500)],
  );
  return rows.map((row) => ({
    id: row.id,
    plan: row.plan,
    status: row.status,
    provider: row.provider,
    providerId: row.provider_subscription_id,
    countryCode: row.country_code,
    seats: row.seats,
    currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    createdAt: row.created_at.toISOString(),
    owner: row.organization_id
      ? { kind: 'organization', id: row.organization_id, name: row.organization_name! }
      : { kind: 'user', id: row.user_id!, name: row.display_name },
    stripeCustomerId: row.customer,
  }));
}

/** Which learner or organization a Stripe customer is, for naming a payment's payer. */
export async function ownersOfStripeCustomers(
  db: Db,
  customerIds: readonly string[],
): Promise<Map<string, AdminSubscription['owner']>> {
  const owners = new Map<string, AdminSubscription['owner']>();
  if (customerIds.length === 0) return owners;
  const { rows } = await db.query<{
    customer: string;
    user_id: string | null;
    display_name: string | null;
    organization_id: string | null;
    organization_name: string | null;
  }>(
    `select bc.stripe_customer_id as customer, bc.user_id, p.display_name,
            null::uuid as organization_id, null::text as organization_name
     from public.billing_customers bc join public.profiles p on p.id = bc.user_id
     where bc.stripe_customer_id = any($1)
     union all
     select oc.stripe_customer_id, null, null, o.id, o.name
     from public.org_billing_customers oc join public.organizations o on o.id = oc.organization_id
     where oc.stripe_customer_id = any($1)`,
    [customerIds],
  );
  for (const row of rows) {
    owners.set(
      row.customer,
      row.organization_id
        ? { kind: 'organization', id: row.organization_id, name: row.organization_name! }
        : { kind: 'user', id: row.user_id!, name: row.display_name },
    );
  }
  return owners;
}

// --- Organizations -------------------------------------------------------------

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  members: number;
  /** Invitations sent, not yet accepted and not yet run out. */
  invited: number;
  /** Seats it may fill: paid for, or granted by staff. Null when it has none. */
  seats: number | null;
  /** The seat subscription in force, if it pays for its seats. */
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  stripeCustomerId: string | null;
}

/** Every organization, newest first, with how many seats it has and how many it has filled. */
export async function listOrganizationsForAdmin(db: Db, limit = 200): Promise<AdminOrganization[]> {
  const { rows } = await db.query<{
    id: string;
    name: string;
    slug: string;
    created_at: Date;
    members: string;
    invited: string;
    seat_limit: number | null;
    paid_seats: number | null;
    status: string | null;
    current_period_end: Date | null;
    cancel_at_period_end: boolean | null;
    customer: string | null;
  }>(
    `select o.id, o.name, o.slug, o.created_at, o.seat_limit,
            (select count(*) from public.org_members m where m.organization_id = o.id) as members,
            (select count(*) from public.org_invites i
             where i.organization_id = o.id and i.expires_at > now()) as invited,
            team.seats as paid_seats, team.status, team.current_period_end, team.cancel_at_period_end,
            oc.stripe_customer_id as customer
     from public.organizations o
     left join lateral (
       select s.seats, s.status::text, s.current_period_end, s.cancel_at_period_end
       from public.subscriptions s
       where s.organization_id = o.id and s.status in ('active', 'trialing', 'past_due')
       order by s.created_at desc
       limit 1
     ) team on true
     left join public.org_billing_customers oc on oc.organization_id = o.id
     order by o.created_at desc, o.id
     limit $1`,
    [Math.min(Math.max(limit, 1), 500)],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at.toISOString(),
    members: Number(row.members),
    invited: Number(row.invited),
    seats: row.paid_seats ?? row.seat_limit,
    subscription: row.status
      ? {
          status: row.status,
          currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
          cancelAtPeriodEnd: row.cancel_at_period_end === true,
        }
      : null,
    stripeCustomerId: row.customer,
  }));
}

// --- AI use --------------------------------------------------------------------

export interface AiDay {
  /** The day, in UTC: "2026-10-13". */
  day: string;
  requests: number;
  /** Learners who made at least one request. */
  users: number;
  /** Tokens by model, for working out the cost. */
  tokens: AiTokens[];
}

/** AI requests and the tokens they used for each of the last `days` days (UTC), newest first. */
export async function aiUsageByDay(db: Db, days = 14): Promise<AiDay[]> {
  const span = Math.min(Math.max(Math.trunc(days), 1), 90);
  const { rows } = await db.query<{
    day: string;
    model: string;
    requests: string;
    input: string;
    output: string;
    cache_read: string;
    cache_write: string;
  }>(
    `select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day, model,
            count(*) as requests, sum(input_tokens) as input, sum(output_tokens) as output,
            sum(cache_read_tokens) as cache_read, sum(cache_write_tokens) as cache_write
     from public.ai_usage
     where created_at >= (date_trunc('day', now() at time zone 'UTC') - make_interval(days => $1 - 1))
                         at time zone 'UTC'
     group by 1, 2
     order by 1 desc, 2`,
    [span],
  );
  const users = await db.query<{ day: string; users: string }>(
    `select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day,
            count(distinct user_id) as users
     from public.ai_usage
     where created_at >= (date_trunc('day', now() at time zone 'UTC') - make_interval(days => $1 - 1))
                         at time zone 'UTC'
     group by 1`,
    [span],
  );
  const usersOn = new Map(users.rows.map((row) => [row.day, Number(row.users)]));
  const byDay = new Map<string, AiDay>();
  for (const row of rows) {
    const day = byDay.get(row.day) ?? {
      day: row.day,
      requests: 0,
      users: usersOn.get(row.day) ?? 0,
      tokens: [],
    };
    day.requests += Number(row.requests);
    day.tokens.push({
      model: row.model,
      input: Number(row.input),
      output: Number(row.output),
      cacheRead: Number(row.cache_read),
      cacheWrite: Number(row.cache_write),
    });
    byDay.set(row.day, day);
  }
  return [...byDay.values()];
}

/** How many AI requests the whole service has made in the last 24 hours: what the daily limit counts. */
export async function aiRequestsLastDay(db: Db): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `select count(*) as n from public.ai_usage where created_at > now() - interval '24 hours'`,
  );
  return Number(rows[0]!.n);
}

export interface AiUserDay {
  userId: string;
  displayName: string | null;
  /** On Pro, so held to the larger allowance. */
  pro: boolean;
  /** Requests in the last 24 hours, by feature. */
  requests: Record<string, number>;
  tokens: AiTokens[];
}

/** The learners who used the AI most in the last 24 hours, heaviest first. */
export async function aiUsageByUserLastDay(db: Db, limit = 50): Promise<AiUserDay[]> {
  const { rows } = await db.query<{
    user_id: string;
    display_name: string | null;
    pro: boolean;
    feature: string;
    model: string;
    requests: string;
    input: string;
    output: string;
    cache_read: string;
    cache_write: string;
  }>(
    `with top as (
       select user_id, count(*) as total from public.ai_usage
       where created_at > now() - interval '24 hours'
       group by user_id order by total desc, user_id limit $1
     )
     select u.user_id, p.display_name, u.feature::text, u.model,
            exists (select 1 from public.subscriptions s
                    where s.user_id = u.user_id and ${PRO_IN_FORCE}) as pro,
            count(*) as requests, sum(u.input_tokens) as input, sum(u.output_tokens) as output,
            sum(u.cache_read_tokens) as cache_read, sum(u.cache_write_tokens) as cache_write
     from public.ai_usage u
     join top on top.user_id = u.user_id
     join public.profiles p on p.id = u.user_id
     where u.created_at > now() - interval '24 hours'
     group by u.user_id, p.display_name, u.feature, u.model, top.total
     order by top.total desc, u.user_id, u.feature`,
    [Math.min(Math.max(limit, 1), 200)],
  );
  const byUser = new Map<string, AiUserDay>();
  for (const row of rows) {
    const user = byUser.get(row.user_id) ?? {
      userId: row.user_id,
      displayName: row.display_name,
      pro: row.pro,
      requests: {},
      tokens: [],
    };
    user.requests[row.feature] = (user.requests[row.feature] ?? 0) + Number(row.requests);
    user.tokens.push({
      model: row.model,
      input: Number(row.input),
      output: Number(row.output),
      cacheRead: Number(row.cache_read),
      cacheWrite: Number(row.cache_write),
    });
    byUser.set(row.user_id, user);
  }
  return [...byUser.values()];
}
