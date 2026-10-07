import { describe, expect, it } from 'vitest';

import { planFromProductId } from '../billing';

import {
  changeFromRevenueCat,
  changeFromStripeSubscription,
  isRevenueCatAuthorized,
  teamChangeFromStripeSubscription,
  type RevenueCatEvent,
} from './billing';

const prices = { pro_monthly: 'price_month', pro_yearly: 'price_year', country_pass: 'price_pass' };
const at = new Date('2026-10-06T12:00:00Z');
const unix = (iso: string) => Date.parse(iso) / 1000;

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: 'sub_123',
  status: 'active',
  customer: 'cus_1',
  metadata: { user_id: 'u1' },
  cancel_at_period_end: false,
  cancel_at: null,
  ended_at: null,
  current_period_start: unix('2026-10-01T00:00:00Z'),
  current_period_end: unix('2026-11-01T00:00:00Z'),
  items: { data: [{ price: { id: 'price_month' } }] },
  ...overrides,
});

describe('changeFromStripeSubscription', () => {
  it('reads the plan from the price, and the period it is paid for', () => {
    expect(changeFromStripeSubscription(subscription(), prices, at)).toEqual({
      plan: 'pro_monthly',
      countryCode: null,
      status: 'active',
      provider: 'stripe',
      providerId: 'sub_123',
      currentPeriodStart: new Date('2026-10-01T00:00:00Z'),
      currentPeriodEnd: new Date('2026-11-01T00:00:00Z'),
      cancelAtPeriodEnd: false,
      at,
    });
    const yearly = subscription({ items: { data: [{ price: 'price_year' }] } });
    expect(changeFromStripeSubscription(yearly, prices, at)?.plan).toBe('pro_yearly');
  });

  it('finds the period on the item, where newer Stripe versions put it', () => {
    const newer = subscription({
      current_period_start: undefined,
      current_period_end: undefined,
      items: {
        data: [
          {
            price: { id: 'price_year' },
            current_period_start: unix('2026-10-01T00:00:00Z'),
            current_period_end: unix('2027-10-01T00:00:00Z'),
          },
        ],
      },
    });
    expect(changeFromStripeSubscription(newer, prices, at)).toMatchObject({
      plan: 'pro_yearly',
      currentPeriodStart: new Date('2026-10-01T00:00:00Z'),
      currentPeriodEnd: new Date('2027-10-01T00:00:00Z'),
    });
  });

  it('falls back to the plan named at checkout when the price has been replaced', () => {
    const moved = subscription({
      items: { data: [{ price: { id: 'price_new' } }] },
      metadata: { plan: 'pro_yearly' },
    });
    expect(changeFromStripeSubscription(moved, prices, at)?.plan).toBe('pro_yearly');
    // Something sold on the same Stripe account that is not ours to record.
    const other = subscription({
      items: { data: [{ price: { id: 'price_other' } }] },
      metadata: {},
    });
    expect(changeFromStripeSubscription(other, prices, at)).toBeNull();
    expect(
      changeFromStripeSubscription(
        subscription({ metadata: { plan: 'country_pass' }, items: {} }),
        prices,
        at,
      ),
    ).toBeNull();
  });

  it('marks a subscription that will not renew, and keeps it to its end date', () => {
    const cancelling = subscription({ cancel_at_period_end: true });
    expect(changeFromStripeSubscription(cancelling, prices, at)).toMatchObject({
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date('2026-11-01T00:00:00Z'),
    });
    // Set to stop on a chosen date rather than at the period's end.
    const scheduled = subscription({ cancel_at: unix('2026-10-20T00:00:00Z') });
    expect(changeFromStripeSubscription(scheduled, prices, at)).toMatchObject({
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date('2026-10-20T00:00:00Z'),
    });
  });

  it('ends a cancelled subscription when it actually ended', () => {
    const ended = subscription({ status: 'canceled', ended_at: unix('2026-10-06T11:00:00Z') });
    expect(changeFromStripeSubscription(ended, prices, at)).toMatchObject({
      status: 'canceled',
      currentPeriodEnd: new Date('2026-10-06T11:00:00Z'),
    });
    const noEndedAt = subscription({ status: 'canceled' });
    expect(changeFromStripeSubscription(noEndedAt, prices, at)?.currentPeriodEnd).toEqual(
      new Date('2026-11-01T00:00:00Z'),
    );
  });

  it('maps Stripe’s statuses onto ours, and waits for a first payment to go through', () => {
    const status = (value: string) =>
      changeFromStripeSubscription(subscription({ status: value }), prices, at)?.status ?? null;
    expect(status('trialing')).toBe('trialing');
    expect(status('past_due')).toBe('past_due');
    expect(status('unpaid')).toBe('past_due');
    expect(status('paused')).toBe('canceled');
    expect(status('incomplete_expired')).toBe('expired');
    expect(status('incomplete')).toBeNull();
    expect(changeFromStripeSubscription(subscription({ id: undefined }), prices, at)).toBeNull();
  });
});

describe('planFromProductId', () => {
  it('tells the plans apart by how the store products are named', () => {
    expect(planFromProductId('oathly_pro_monthly')).toEqual({
      plan: 'pro_monthly',
      countryCode: null,
    });
    expect(planFromProductId('oathly_pro_yearly')).toEqual({
      plan: 'pro_yearly',
      countryCode: null,
    });
    expect(planFromProductId('com.oathly.pro.annual')).toEqual({
      plan: 'pro_yearly',
      countryCode: null,
    });
    expect(planFromProductId('oathly_country_pass_us')).toEqual({
      plan: 'country_pass',
      countryCode: 'US',
    });
    expect(planFromProductId('com.oathly.country_pass.GB')).toEqual({
      plan: 'country_pass',
      countryCode: 'GB',
    });
    // Google Play appends the base plan to a subscription's id.
    expect(planFromProductId('oathly_pro_monthly:monthly-autorenew')?.plan).toBe('pro_monthly');
    expect(planFromProductId('oathly_country_pass')).toBeNull();
    expect(planFromProductId('tip_jar')).toBeNull();
  });
});

describe('changeFromRevenueCat', () => {
  const event = (overrides: Partial<RevenueCatEvent> = {}): RevenueCatEvent => ({
    id: 'evt_1',
    type: 'INITIAL_PURCHASE',
    app_user_id: 'u1',
    product_id: 'oathly_pro_yearly',
    period_type: 'NORMAL',
    store: 'APP_STORE',
    purchased_at_ms: Date.parse('2026-10-01T00:00:00Z'),
    expiration_at_ms: Date.parse('2027-10-01T00:00:00Z'),
    event_timestamp_ms: at.getTime(),
    original_transaction_id: 'tx_1',
    ...overrides,
  });

  it('records a purchase or renewal as running to its expiry', () => {
    expect(changeFromRevenueCat(event())).toEqual({
      plan: 'pro_yearly',
      countryCode: null,
      provider: 'app_store',
      providerId: 'tx_1',
      currentPeriodStart: new Date('2026-10-01T00:00:00Z'),
      status: 'active',
      currentPeriodEnd: new Date('2027-10-01T00:00:00Z'),
      cancelAtPeriodEnd: false,
      at,
    });
    expect(changeFromRevenueCat(event({ type: 'RENEWAL', store: 'PLAY_STORE' }))).toMatchObject({
      provider: 'play_store',
      status: 'active',
    });
    expect(changeFromRevenueCat(event({ period_type: 'TRIAL' }))?.status).toBe('trialing');
    expect(changeFromRevenueCat(event({ type: 'UNCANCELLATION' }))?.cancelAtPeriodEnd).toBe(false);
  });

  it('records a Country Pass as held for good', () => {
    const pass = event({
      type: 'NON_RENEWING_PURCHASE',
      product_id: 'oathly_country_pass_ca',
      expiration_at_ms: null,
    });
    expect(changeFromRevenueCat(pass)).toMatchObject({
      plan: 'country_pass',
      countryCode: 'CA',
      status: 'active',
      currentPeriodEnd: null,
    });
  });

  it('keeps a cancelled subscription until it runs out, unless the store refunded it', () => {
    expect(
      changeFromRevenueCat(event({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' })),
    ).toMatchObject({
      status: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date('2027-10-01T00:00:00Z'),
    });
    expect(
      changeFromRevenueCat(event({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT' })),
    ).toMatchObject({ status: 'canceled', currentPeriodEnd: at });
    // A pass cannot be "unsubscribed": only a refund takes it away.
    const pass = { product_id: 'oathly_country_pass_ca', type: 'CANCELLATION' };
    expect(changeFromRevenueCat(event({ ...pass, cancel_reason: 'UNSUBSCRIBE' }))).toBeNull();
    expect(
      changeFromRevenueCat(event({ ...pass, cancel_reason: 'CUSTOMER_SUPPORT' }))?.status,
    ).toBe('canceled');
  });

  it('gives a failed renewal the store’s grace period, then expires it', () => {
    const grace = Date.parse('2027-10-17T00:00:00Z');
    expect(
      changeFromRevenueCat(event({ type: 'BILLING_ISSUE', grace_period_expiration_at_ms: grace })),
    ).toMatchObject({ status: 'past_due', currentPeriodEnd: new Date(grace) });
    expect(changeFromRevenueCat(event({ type: 'BILLING_ISSUE' }))?.currentPeriodEnd).toEqual(
      new Date('2027-10-01T00:00:00Z'),
    );
    expect(changeFromRevenueCat(event({ type: 'EXPIRATION' }))).toMatchObject({
      status: 'expired',
      currentPeriodEnd: new Date('2027-10-01T00:00:00Z'),
    });
    expect(
      changeFromRevenueCat(event({ type: 'EXPIRATION', expiration_at_ms: null }))?.currentPeriodEnd,
    ).toEqual(at);
  });

  it('ignores what does not change what anyone holds', () => {
    expect(changeFromRevenueCat(event({ type: 'TEST' }))).toBeNull();
    expect(changeFromRevenueCat(event({ type: 'SUBSCRIBER_ALIAS' }))).toBeNull();
    expect(changeFromRevenueCat(event({ product_id: 'tip_jar' }))).toBeNull();
    expect(changeFromRevenueCat(event({ product_id: null }))).toBeNull();
    // Web purchases come straight from Stripe, not by way of RevenueCat.
    expect(changeFromRevenueCat(event({ store: 'STRIPE' }))).toBeNull();
    expect(changeFromRevenueCat(event({ original_transaction_id: null }))).toBeNull();
    expect(
      changeFromRevenueCat(event({ original_transaction_id: null, transaction_id: 'tx_9' }))
        ?.providerId,
    ).toBe('tx_9');
    expect(changeFromRevenueCat(event({ store: 'PROMOTIONAL' }))?.provider).toBe('manual');
    expect(changeFromRevenueCat(event({ event_timestamp_ms: null }))?.at).toBeInstanceOf(Date);
  });
});

describe('isRevenueCatAuthorized', () => {
  const secret = 'a-long-enough-webhook-secret';
  it('accepts only the secret we gave RevenueCat', () => {
    expect(isRevenueCatAuthorized(secret, secret)).toBe(true);
    expect(isRevenueCatAuthorized(`Bearer ${secret}`, secret)).toBe(true);
    expect(isRevenueCatAuthorized('a-long-enough-webhook-secreT', secret)).toBe(false);
    expect(isRevenueCatAuthorized('short', secret)).toBe(false);
    expect(isRevenueCatAuthorized(null, secret)).toBe(false);
    // Unset or weak: nothing gets in.
    expect(isRevenueCatAuthorized('', undefined)).toBe(false);
    expect(isRevenueCatAuthorized('tooshort', 'tooshort')).toBe(false);
  });
});

describe('teamChangeFromStripeSubscription', () => {
  const teamPrices = { ...prices, team: 'price_seat' };
  const seats = (quantity: unknown, overrides: Record<string, unknown> = {}) =>
    subscription({
      metadata: { organization_id: 'org-1', plan: 'team', user_id: 'u1' },
      items: { data: [{ price: { id: 'price_seat' }, quantity }] },
      ...overrides,
    });

  it('reads an organization’s seats from the quantity bought', () => {
    expect(teamChangeFromStripeSubscription(seats(12), teamPrices, at)).toEqual({
      organizationId: 'org-1',
      seats: 12,
      status: 'active',
      providerId: 'sub_123',
      currentPeriodStart: new Date('2026-10-01T00:00:00Z'),
      currentPeriodEnd: new Date('2026-11-01T00:00:00Z'),
      cancelAtPeriodEnd: false,
      at,
    });
  });

  it('knows a seat subscription by its price or by what it was bought as', () => {
    // The price alone: the organization is then found from the Stripe customer.
    const byPrice = seats(3, { metadata: {} });
    expect(teamChangeFromStripeSubscription(byPrice, teamPrices, at)).toMatchObject({
      organizationId: null,
      seats: 3,
    });
    // The metadata alone, as when the seat price has since been replaced.
    const byMetadata = seats(3, { items: { data: [{ price: { id: 'price_old' }, quantity: 3 }] } });
    expect(teamChangeFromStripeSubscription(byMetadata, prices, at)?.seats).toBe(3);
  });

  it('is not a learner’s plan, and a learner’s plan is not seats', () => {
    expect(changeFromStripeSubscription(seats(5), teamPrices, at)).toBeNull();
    expect(teamChangeFromStripeSubscription(subscription(), teamPrices, at)).toBeNull();
    expect(teamChangeFromStripeSubscription(subscription(), prices, at)).toBeNull();
  });

  it('refuses a seat count that is not a whole number of seats', () => {
    for (const quantity of [0, -2, 2.5, '4', undefined, null]) {
      expect(teamChangeFromStripeSubscription(seats(quantity), teamPrices, at)).toBeNull();
    }
  });

  it('carries cancellation and the end of the paid period like any subscription', () => {
    const cancelling = seats(4, { cancel_at_period_end: true });
    expect(teamChangeFromStripeSubscription(cancelling, teamPrices, at)).toMatchObject({
      status: 'active',
      cancelAtPeriodEnd: true,
    });
    const ended = seats(4, { status: 'canceled', ended_at: unix('2026-10-20T00:00:00Z') });
    expect(teamChangeFromStripeSubscription(ended, teamPrices, at)).toMatchObject({
      status: 'canceled',
      currentPeriodEnd: new Date('2026-10-20T00:00:00Z'),
    });
    expect(
      teamChangeFromStripeSubscription(seats(4, { status: 'incomplete' }), teamPrices, at),
    ).toBeNull();
  });
});
