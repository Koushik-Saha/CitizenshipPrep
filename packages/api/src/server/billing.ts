import { timingSafeEqual } from 'node:crypto';

import {
  isPaidPlan,
  seatSource,
  type AccessUser,
  type Entitlement,
  type PaidPlan,
  type SubscriptionStatus,
} from '@oathly/core';
import type pg from 'pg';

import { planFromProductId } from '../billing';

// Billing on the server: what a learner holds, and turning the payment
// providers' webhook events into rows of public.subscriptions.
//
//   Stripe      web purchases: Checkout for Pro and the Country Pass
//   RevenueCat  App Store and Google Play purchases made in the mobile app
//
// Both write the same table, and access everywhere is read from it (through
// hasAccess in packages/core), so something bought on one device is there on
// every other.

type Db = Pick<pg.Pool, 'query'>;
type Provider = Entitlement['provider'];

// What a learner holds --------------------------------------------------------

/**
 * Everything each of these learners holds, in force or not: what they bought
 * themselves, and a seat in any organization that has one for them.
 */
export async function entitlementsFor(
  db: Db,
  userIds: readonly string[],
): Promise<Map<string, Entitlement[]>> {
  const held = new Map<string, Entitlement[]>(userIds.map((userId) => [userId, []]));
  if (userIds.length === 0) return held;

  const own = await db.query<{
    user_id: string;
    plan: string;
    country_code: string | null;
    status: SubscriptionStatus;
    current_period_end: Date | null;
    cancel_at_period_end: boolean;
    provider: Provider;
  }>(
    `select user_id, plan, country_code, status, current_period_end, cancel_at_period_end, provider
     from public.subscriptions
     where user_id = any($1)
     order by created_at`,
    [userIds],
  );
  for (const row of own.rows) {
    if (!isPaidPlan(row.plan)) continue;
    held.get(row.user_id)!.push({
      plan: row.plan,
      countryCode: row.country_code,
      status: row.status,
      currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      provider: row.provider,
    });
  }

  // Seats: `ahead` is how many learners joined the organization before this one.
  const memberships = await db.query<{
    user_id: string;
    organization_id: string;
    name: string;
    seat_limit: number | null;
    ahead: number;
  }>(
    `select m.user_id, m.organization_id, o.name, o.seat_limit,
            (select count(*)::int from public.org_members x
             where x.organization_id = m.organization_id and x.role = 'member'
               and (x.created_at, x.user_id) < (m.created_at, m.user_id)) as ahead
     from public.org_members m
     join public.organizations o on o.id = m.organization_id
     where m.user_id = any($1) and m.role = 'member'
     order by m.created_at`,
    [userIds],
  );
  if (memberships.rows.length === 0) return held;
  const paid = await teamSubscriptions(db, [
    ...new Set(memberships.rows.map((row) => row.organization_id)),
  ]);
  for (const row of memberships.rows) {
    const source = seatSource(row.ahead, row.seat_limit, paid.get(row.organization_id) ?? []);
    if (source === null) continue;
    held.get(row.user_id)!.push({
      plan: 'team',
      countryCode: null,
      status: source === 'granted' ? 'active' : source.status,
      currentPeriodEnd: source === 'granted' ? null : source.currentPeriodEnd,
      cancelAtPeriodEnd: source === 'granted' ? false : source.cancelAtPeriodEnd,
      // Managed by the organization, wherever it was paid for.
      provider: 'manual',
      organizationName: row.name,
    });
  }
  return held;
}

/** An organization's subscription for seats. */
export interface TeamSubscription {
  seats: number;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  provider: Provider;
}

/** The seat subscriptions of each of these organizations, newest first. */
export async function teamSubscriptions(
  db: Db,
  organizationIds: readonly string[],
): Promise<Map<string, TeamSubscription[]>> {
  const { rows } = await db.query<{
    organization_id: string;
    seats: number;
    status: SubscriptionStatus;
    current_period_end: Date | null;
    cancel_at_period_end: boolean;
    provider: Provider;
  }>(
    `select organization_id, seats, status, current_period_end, cancel_at_period_end, provider
     from public.subscriptions
     where organization_id = any($1) and plan = 'team'
     order by created_at desc`,
    [organizationIds],
  );
  const byOrganization = new Map<string, TeamSubscription[]>();
  for (const row of rows) {
    const list = byOrganization.get(row.organization_id) ?? [];
    list.push({
      seats: row.seats,
      status: row.status,
      currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      provider: row.provider,
    });
    byOrganization.set(row.organization_id, list);
  }
  return byOrganization;
}

/** Everything a learner holds, in force or not. */
export async function listEntitlements(db: Db, userId: string): Promise<Entitlement[]> {
  return (await entitlementsFor(db, [userId])).get(userId)!;
}

/** A learner as hasAccess wants them. */
export async function accessUser(db: Db, userId: string): Promise<AccessUser> {
  return { entitlements: await listEntitlements(db, userId) };
}

// Writing subscriptions -------------------------------------------------------

/** What a provider says a purchase's state now is. */
export interface SubscriptionChange {
  userId: string;
  plan: PaidPlan;
  /** For a Country Pass. */
  countryCode: string | null;
  status: SubscriptionStatus;
  provider: Provider;
  /** The provider's own id for the purchase: what later events about it will carry. */
  providerId: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** When the provider said so. */
  at: Date;
}

/**
 * Records a purchase's state. Events can arrive out of order and more than
 * once: the row keeps the time of the event it reflects, and an older event
 * changes nothing. Returns whether the row was written.
 */
export async function applySubscriptionChange(
  db: Db,
  change: SubscriptionChange,
): Promise<boolean> {
  const start = change.currentPeriodStart;
  const end = change.currentPeriodEnd;
  const result = await db.query(
    `insert into public.subscriptions
       (user_id, plan, country_code, status, provider, provider_subscription_id,
        current_period_start, current_period_end, cancel_at_period_end, provider_event_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (provider, provider_subscription_id) do update set
       user_id = excluded.user_id,
       plan = excluded.plan,
       country_code = excluded.country_code,
       status = excluded.status,
       current_period_start = excluded.current_period_start,
       current_period_end = excluded.current_period_end,
       cancel_at_period_end = excluded.cancel_at_period_end,
       provider_event_at = excluded.provider_event_at
     where public.subscriptions.provider_event_at is null
        or public.subscriptions.provider_event_at <= excluded.provider_event_at`,
    [
      change.userId,
      change.plan,
      change.countryCode,
      change.status,
      change.provider,
      change.providerId,
      // A period that ends before it starts would be refused; keep the end.
      start && end && start > end ? null : start,
      end,
      change.cancelAtPeriodEnd,
      change.at,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

/** What Stripe says an organization's seat subscription now is. */
export interface TeamSubscriptionChange {
  organizationId: string;
  seats: number;
  status: SubscriptionStatus;
  providerId: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  at: Date;
}

/** Records an organization's seats, with the same ordering rule as a learner's purchase. */
export async function applyTeamSubscriptionChange(
  db: Db,
  change: TeamSubscriptionChange,
): Promise<boolean> {
  const start = change.currentPeriodStart;
  const end = change.currentPeriodEnd;
  const result = await db.query(
    `insert into public.subscriptions
       (organization_id, plan, seats, status, provider, provider_subscription_id,
        current_period_start, current_period_end, cancel_at_period_end, provider_event_at)
     values ($1, 'team', $2, $3, 'stripe', $4, $5, $6, $7, $8)
     on conflict (provider, provider_subscription_id) do update set
       seats = excluded.seats,
       status = excluded.status,
       current_period_start = excluded.current_period_start,
       current_period_end = excluded.current_period_end,
       cancel_at_period_end = excluded.cancel_at_period_end,
       provider_event_at = excluded.provider_event_at
     where public.subscriptions.organization_id = excluded.organization_id
       and (public.subscriptions.provider_event_at is null
            or public.subscriptions.provider_event_at <= excluded.provider_event_at)`,
    [
      change.organizationId,
      change.seats,
      change.status,
      change.providerId,
      start && end && start > end ? null : start,
      end,
      change.cancelAtPeriodEnd,
      change.at,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Notes that an event has been handled. False if it had been already. */
async function firstDelivery(
  db: Db,
  provider: 'stripe' | 'revenuecat',
  event: { id: string; type: string },
  userId: string | null,
): Promise<boolean> {
  const result = await db.query(
    `insert into public.billing_events (provider, event_id, event_type, user_id)
     values ($1, $2, $3, $4) on conflict do nothing`,
    [provider, event.id, event.type, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Takes back the note that an event was handled, after handling it failed.
 * The provider sends a failed event again; without this the second try would
 * be answered "already handled" and a learner who paid would get nothing.
 * Applying an event twice is harmless: each write is an upsert.
 */
async function forgetDelivery(
  db: Db,
  provider: 'stripe' | 'revenuecat',
  eventId: string,
): Promise<void> {
  await db
    .query('delete from public.billing_events where provider = $1 and event_id = $2', [
      provider,
      eventId,
    ])
    .catch(() => {});
}

async function profileExists(db: Db, userId: string): Promise<boolean> {
  const { rowCount } = await db.query('select 1 from public.profiles where id = $1', [userId]);
  return (rowCount ?? 0) > 0;
}

async function countryExists(db: Db, countryCode: string): Promise<boolean> {
  const { rowCount } = await db.query('select 1 from public.countries where iso_code = $1', [
    countryCode,
  ]);
  return (rowCount ?? 0) > 0;
}

/** What handling a webhook event came to. */
export type WebhookOutcome =
  /**
   * A subscription row was written (or already said the same or newer): a
   * learner's own, or an organization's seats.
   */
  | {
      kind: 'applied';
      userId: string | null;
      organizationId?: string;
      /** Set when the event is a purchase starting, not a renewal or a change: for counting upgrades. */
      purchase?: Purchase;
    }
  /** Seen before, or not something that changes what anyone holds. */
  | { kind: 'ignored'; reason: string };

/** What was bought, without who bought it. */
export interface Purchase {
  plan: string;
  provider: string;
  countryCode: string | null;
}

const ignored = (reason: string): WebhookOutcome => ({ kind: 'ignored', reason });

// Stripe ----------------------------------------------------------------------

/** The Stripe price behind each plan, from the environment. */
export interface StripePrices {
  pro_monthly: string;
  pro_yearly: string;
  country_pass: string;
  /** One seat in an organization. Organizations are sold only where this is set. */
  team?: string;
}

/** The Stripe customer a learner already is, if they have bought before. */
export async function stripeCustomerFor(db: Db, userId: string): Promise<string | null> {
  const { rows } = await db.query<{ stripe_customer_id: string }>(
    'select stripe_customer_id from public.billing_customers where user_id = $1',
    [userId],
  );
  return rows[0]?.stripe_customer_id ?? null;
}

/** Remembers which Stripe customer a learner is. The first one linked stays. */
export async function linkStripeCustomer(db: Db, userId: string, customerId: string) {
  await db.query(
    `insert into public.billing_customers (user_id, stripe_customer_id) values ($1, $2)
     on conflict do nothing`,
    [userId, customerId],
  );
}

/** The Stripe customer an organization already is, if it has bought seats before. */
export async function orgStripeCustomerFor(db: Db, organizationId: string): Promise<string | null> {
  const { rows } = await db.query<{ stripe_customer_id: string }>(
    'select stripe_customer_id from public.org_billing_customers where organization_id = $1',
    [organizationId],
  );
  return rows[0]?.stripe_customer_id ?? null;
}

/** Remembers which Stripe customer an organization is. The first one linked stays. */
export async function linkOrgStripeCustomer(db: Db, organizationId: string, customerId: string) {
  await db.query(
    `insert into public.org_billing_customers (organization_id, stripe_customer_id)
     values ($1, $2) on conflict do nothing`,
    [organizationId, customerId],
  );
}

async function orgForStripeCustomer(db: Db, customerId: string): Promise<string | null> {
  const { rows } = await db.query<{ organization_id: string }>(
    'select organization_id from public.org_billing_customers where stripe_customer_id = $1',
    [customerId],
  );
  return rows[0]?.organization_id ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function organizationExists(db: Db, organizationId: string): Promise<boolean> {
  if (!UUID.test(organizationId)) return false;
  const { rowCount } = await db.query('select 1 from public.organizations where id = $1', [
    organizationId,
  ]);
  return (rowCount ?? 0) > 0;
}

async function userForStripeCustomer(db: Db, customerId: string): Promise<string | null> {
  const { rows } = await db.query<{ user_id: string }>(
    'select user_id from public.billing_customers where stripe_customer_id = $1',
    [customerId],
  );
  return rows[0]?.user_id ?? null;
}

/** A Stripe webhook event, as much of it as is used here. */
export interface StripeEvent {
  id: string;
  type: string;
  /** Seconds since 1970. */
  created: number;
  data: { object: Record<string, unknown> };
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;
const seconds = (value: unknown): Date | null =>
  typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : null;
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
/** An id that Stripe gives either bare or as an expanded object. */
const idOf = (value: unknown): string | null => text(value) ?? text(record(value).id);

const stripeStatus: Record<string, SubscriptionStatus | undefined> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  // Stripe has given up collecting: nothing is paid for beyond the period.
  unpaid: 'past_due',
  canceled: 'canceled',
  paused: 'canceled',
  incomplete_expired: 'expired',
  // "incomplete" is a first payment that has not gone through: nothing to record yet.
};

/** The state and dates a Stripe subscription object reports, whatever it is for. */
function stripeSubscriptionState(subscription: Record<string, unknown>) {
  const providerId = text(subscription.id);
  const status = stripeStatus[String(subscription.status)];
  if (!providerId || !status) return null;

  const item = record((record(subscription.items).data as unknown[] | undefined)?.[0]);
  // Newer Stripe API versions report the period on the item, older ones on the subscription.
  const start = seconds(subscription.current_period_start) ?? seconds(item.current_period_start);
  const periodEnd = seconds(subscription.current_period_end) ?? seconds(item.current_period_end);
  // A date to stop at, whether "the end of this period" or one set by hand.
  const cancelAt = seconds(subscription.cancel_at);
  // Once it has ended, that is when it ended, whatever period had been paid for.
  const end =
    status === 'canceled' ? (seconds(subscription.ended_at) ?? periodEnd) : (cancelAt ?? periodEnd);
  return {
    item,
    priceId: idOf(item.price),
    metadata: record(subscription.metadata),
    status,
    providerId,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true || cancelAt !== null,
  };
}

/**
 * What a Stripe subscription object says, as a change to record. Null when
 * it is not (yet) something a learner holds, or not a learner's plan.
 */
export function changeFromStripeSubscription(
  subscription: Record<string, unknown>,
  prices: StripePrices,
  at: Date,
): Omit<SubscriptionChange, 'userId'> | null {
  const state = stripeSubscriptionState(subscription);
  if (!state) return null;
  const { priceId, metadata } = state;
  const plan =
    priceId === prices.pro_monthly
      ? 'pro_monthly'
      : priceId === prices.pro_yearly
        ? 'pro_yearly'
        : metadata.plan === 'pro_monthly' || metadata.plan === 'pro_yearly'
          ? metadata.plan
          : null;
  if (!plan) return null;
  return {
    plan,
    countryCode: null,
    status: state.status,
    provider: 'stripe',
    providerId: state.providerId,
    currentPeriodStart: state.currentPeriodStart,
    currentPeriodEnd: state.currentPeriodEnd,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    at,
  };
}

/**
 * What a Stripe subscription object says about an organization's seats.
 * Null when it is not a seat subscription. The organization is named in the
 * subscription's metadata; when it is not, the caller finds it by customer.
 */
export function teamChangeFromStripeSubscription(
  subscription: Record<string, unknown>,
  prices: StripePrices,
  at: Date,
): (Omit<TeamSubscriptionChange, 'organizationId'> & { organizationId: string | null }) | null {
  const state = stripeSubscriptionState(subscription);
  if (!state) return null;
  const isTeam =
    (prices.team !== undefined && state.priceId === prices.team) || state.metadata.plan === 'team';
  const seats = state.item.quantity;
  if (!isTeam || typeof seats !== 'number' || !Number.isInteger(seats) || seats < 1) return null;
  return {
    organizationId: text(state.metadata.organization_id),
    seats,
    status: state.status,
    providerId: state.providerId,
    currentPeriodStart: state.currentPeriodStart,
    currentPeriodEnd: state.currentPeriodEnd,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
    at,
  };
}

/**
 * Handles one verified Stripe webhook event. Safe to call again with the
 * same event, and with events out of order.
 */
export async function applyStripeEvent(
  db: Db,
  event: StripeEvent,
  prices: StripePrices,
): Promise<WebhookOutcome> {
  try {
    return await applyStripeEventOnce(db, event, prices);
  } catch (error) {
    await forgetDelivery(db, 'stripe', event.id);
    throw error;
  }
}

async function applyStripeEventOnce(
  db: Db,
  event: StripeEvent,
  prices: StripePrices,
): Promise<WebhookOutcome> {
  const object = event.data.object;
  const at = new Date(event.created * 1000);
  const metadata = record(object.metadata);

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const userId = text(object.client_reference_id) ?? text(metadata.user_id);
      if (!userId || !(await profileExists(db, userId))) return ignored('no such learner');
      if (!(await firstDelivery(db, 'stripe', event, userId))) return ignored('already handled');
      const customerId = idOf(object.customer);
      if (metadata.plan === 'team') {
        // Seats: the customer is the organization, not the admin who paid.
        const organizationId = text(metadata.organization_id);
        if (customerId && organizationId && (await organizationExists(db, organizationId))) {
          await linkOrgStripeCustomer(db, organizationId, customerId);
        }
        return ignored('seats are recorded from the subscription');
      }
      if (customerId) await linkStripeCustomer(db, userId, customerId);
      // A subscription reports itself through its own events. A Country Pass
      // is a single payment, and this is the only word of it.
      if (object.mode !== 'payment' || metadata.plan !== 'country_pass') {
        return ignored('nothing bought outright');
      }
      if (object.payment_status !== 'paid') return ignored('not paid yet');
      const countryCode = text(metadata.country_code)?.toUpperCase();
      if (!countryCode || !(await countryExists(db, countryCode)))
        return ignored('no such country');
      await applySubscriptionChange(db, {
        userId,
        plan: 'country_pass',
        countryCode,
        status: 'active',
        provider: 'stripe',
        // The payment is what a refund will name.
        providerId: idOf(object.payment_intent) ?? String(object.id),
        currentPeriodStart: at,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        at,
      });
      return {
        kind: 'applied',
        userId,
        purchase: { plan: 'country_pass', provider: 'stripe', countryCode },
      };
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      // A subscription is created once, when it is bought.
      const started = event.type === 'customer.subscription.created';
      const team = teamChangeFromStripeSubscription(object, prices, at);
      if (team) {
        const customer = idOf(object.customer);
        const organizationId =
          team.organizationId ?? (customer ? await orgForStripeCustomer(db, customer) : null);
        if (!organizationId || !(await organizationExists(db, organizationId))) {
          return ignored('no such organization');
        }
        const buyer = text(metadata.user_id);
        const userId = buyer && (await profileExists(db, buyer)) ? buyer : null;
        if (!(await firstDelivery(db, 'stripe', event, userId))) return ignored('already handled');
        if (customer) await linkOrgStripeCustomer(db, organizationId, customer);
        await applyTeamSubscriptionChange(db, { ...team, organizationId });
        return {
          kind: 'applied',
          userId,
          organizationId,
          ...(started ? { purchase: { plan: 'team', provider: 'stripe', countryCode: null } } : {}),
        };
      }
      const change = changeFromStripeSubscription(object, prices, at);
      if (!change) return ignored('not a plan to record');
      const customerId = idOf(object.customer);
      const userId =
        text(metadata.user_id) ?? (customerId ? await userForStripeCustomer(db, customerId) : null);
      if (!userId || !(await profileExists(db, userId))) return ignored('no such learner');
      if (!(await firstDelivery(db, 'stripe', event, userId))) return ignored('already handled');
      if (customerId) await linkStripeCustomer(db, userId, customerId);
      await applySubscriptionChange(db, { ...change, userId });
      return {
        kind: 'applied',
        userId,
        ...(started
          ? { purchase: { plan: change.plan, provider: 'stripe', countryCode: change.countryCode } }
          : {}),
      };
    }

    case 'charge.refunded': {
      // A Country Pass refunded in full is no longer held.
      const payment = idOf(object.payment_intent);
      if (!payment || object.refunded !== true) return ignored('not a full refund');
      const { rows } = await db.query<{ user_id: string }>(
        `update public.subscriptions
         set status = 'canceled', current_period_end = $2, provider_event_at = $2
         where provider = 'stripe' and provider_subscription_id = $1 and plan = 'country_pass'
         returning user_id`,
        [payment, at],
      );
      if (!rows[0]) return ignored('not a pass');
      await firstDelivery(db, 'stripe', event, rows[0].user_id);
      return { kind: 'applied', userId: rows[0].user_id };
    }

    default:
      return ignored('not an event that changes access');
  }
}

// RevenueCat ------------------------------------------------------------------

/** A RevenueCat webhook event, as much of it as is used here. */
export interface RevenueCatEvent {
  id: string;
  type: string;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  product_id?: string | null;
  period_type?: string | null;
  store?: string | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
  event_timestamp_ms?: number | null;
  original_transaction_id?: string | null;
  transaction_id?: string | null;
  cancel_reason?: string | null;
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
  /** "PRODUCTION", or "SANDBOX" for a purchase made with a store test account. */
  environment?: string | null;
}

export interface RevenueCatOptions {
  /**
   * Whether a test (sandbox) purchase counts for this learner. It costs
   * nothing, so by default it gives nothing; a store reviewer's account is
   * the usual exception.
   */
  allowSandbox?: (userId: string) => boolean;
}

const millis = (value: number | null | undefined): Date | null =>
  typeof value === 'number' && Number.isFinite(value) ? new Date(value) : null;

const storeProvider: Record<string, Provider | undefined> = {
  APP_STORE: 'app_store',
  MAC_APP_STORE: 'app_store',
  PLAY_STORE: 'play_store',
  // Granted by hand in RevenueCat's dashboard.
  PROMOTIONAL: 'manual',
  // "STRIPE" is left out on purpose: web purchases come straight from Stripe.
};

/**
 * What a RevenueCat event says, as a change to record. Null for events that
 * change nothing a learner holds.
 */
export function changeFromRevenueCat(
  event: RevenueCatEvent,
): Omit<SubscriptionChange, 'userId'> | null {
  const product = event.product_id ? planFromProductId(event.product_id) : null;
  const provider = storeProvider[String(event.store)];
  const providerId = event.original_transaction_id ?? event.transaction_id;
  if (!product || !provider || !providerId) return null;

  const at = millis(event.event_timestamp_ms) ?? new Date();
  const expires = millis(event.expiration_at_ms);
  const base = {
    ...product,
    provider,
    providerId,
    currentPeriodStart: millis(event.purchased_at_ms),
    at,
  };
  const isPass = product.plan === 'country_pass';

  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
    case 'SUBSCRIPTION_EXTENDED':
    case 'NON_RENEWING_PURCHASE':
      return {
        ...base,
        status: event.period_type === 'TRIAL' ? 'trialing' : 'active',
        // A pass is bought once and does not run out.
        currentPeriodEnd: isPass ? null : expires,
        cancelAtPeriodEnd: false,
      };
    case 'CANCELLATION':
      // Refunded by the store: gone now. Otherwise the learner has only
      // turned renewal off, and keeps what they paid for until it runs out.
      return event.cancel_reason === 'CUSTOMER_SUPPORT'
        ? { ...base, status: 'canceled', currentPeriodEnd: at, cancelAtPeriodEnd: true }
        : isPass
          ? null
          : { ...base, status: 'active', currentPeriodEnd: expires, cancelAtPeriodEnd: true };
    case 'BILLING_ISSUE':
      // The store is retrying the payment and allows some days' grace.
      return {
        ...base,
        status: 'past_due',
        currentPeriodEnd: millis(event.grace_period_expiration_at_ms) ?? expires,
        cancelAtPeriodEnd: false,
      };
    case 'EXPIRATION':
      return {
        ...base,
        status: 'expired',
        currentPeriodEnd: expires ?? at,
        cancelAtPeriodEnd: true,
      };
    default:
      return null;
  }
}

/**
 * Handles one authenticated RevenueCat webhook event. The app tells
 * RevenueCat who is buying by their Oathly user id, so the event's app user
 * id is the learner.
 */
export async function applyRevenueCatEvent(
  db: Db,
  event: RevenueCatEvent,
  options: RevenueCatOptions = {},
): Promise<WebhookOutcome> {
  try {
    return await applyRevenueCatEventOnce(db, event, options);
  } catch (error) {
    await forgetDelivery(db, 'revenuecat', event.id);
    throw error;
  }
}

async function applyRevenueCatEventOnce(
  db: Db,
  event: RevenueCatEvent,
  options: RevenueCatOptions,
): Promise<WebhookOutcome> {
  const sandbox = event.environment?.toUpperCase() === 'SANDBOX';
  const letIn = (userId: string) => !sandbox || options.allowSandbox?.(userId) === true;
  if (event.type === 'TRANSFER') {
    // The store account moved to another Oathly account ("restore purchases"
    // after signing in as someone else): what it bought moves with it.
    const from = event.transferred_from ?? [];
    let to: string | null = null;
    for (const candidate of event.transferred_to ?? []) {
      if (await profileExists(db, candidate)) to ??= candidate;
    }
    if (!to || from.length === 0) return ignored('no learner to transfer to');
    if (!letIn(to)) return ignored('a test purchase');
    if (!(await firstDelivery(db, 'revenuecat', event, to))) return ignored('already handled');
    await db.query(
      `update public.subscriptions set user_id = $1
       where user_id = any($2) and provider in ('app_store', 'play_store')`,
      [to, from],
    );
    return { kind: 'applied', userId: to };
  }

  const change = changeFromRevenueCat(event);
  if (!change) return ignored('not an event that changes access');
  let userId: string | null = null;
  for (const candidate of [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
  ]) {
    if (candidate && (await profileExists(db, candidate))) userId ??= candidate;
  }
  if (!userId) return ignored('no such learner');
  if (!letIn(userId)) return ignored('a test purchase');
  if (change.countryCode && !(await countryExists(db, change.countryCode))) {
    return ignored('no such country');
  }
  if (!(await firstDelivery(db, 'revenuecat', event, userId))) return ignored('already handled');
  await applySubscriptionChange(db, { ...change, userId });
  const started = event.type === 'INITIAL_PURCHASE' || event.type === 'NON_RENEWING_PURCHASE';
  return {
    kind: 'applied',
    userId,
    ...(started
      ? {
          purchase: {
            plan: change.plan,
            provider: change.provider,
            countryCode: change.countryCode,
          },
        }
      : {}),
  };
}

/** Whether a webhook's Authorization header is the secret we gave RevenueCat. */
export function isRevenueCatAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !header) return false;
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ''));
  const wanted = Buffer.from(secret);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
