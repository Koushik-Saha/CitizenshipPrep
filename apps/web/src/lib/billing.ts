import type { PlanPrice, Purchase } from '@oathly/api/billing';
import {
  linkOrgStripeCustomer,
  linkStripeCustomer,
  orgStripeCustomerFor,
  stripeCustomerFor,
  type StripePrices,
} from '@oathly/api/server';
import type { UiLocale } from '@oathly/i18n';
import { headers } from 'next/headers';
import Stripe from 'stripe';

import { getDb } from './db';

// Stripe, for web purchases: Checkout to buy, the customer portal to manage,
// and webhooks (app/api/billing/stripe/webhook) to record what happened.
// Nothing here decides what a plan unlocks: that is hasAccess in
// packages/core, reading the subscriptions table the webhooks write.

/** The Stripe price behind each plan. All three must be set for plans to be sold. */
export function stripePrices(): StripePrices | null {
  const prices = {
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
    pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? '',
    country_pass: process.env.STRIPE_PRICE_COUNTRY_PASS ?? '',
  };
  if (!Object.values(prices).every((id) => id.startsWith('price_'))) return null;
  const team = seatPriceId();
  return team ? { ...prices, team } : prices;
}

/** The Stripe price of one seat in an organization, if seats are sold. */
export function seatPriceId(): string | null {
  const id = process.env.STRIPE_PRICE_ORG_SEAT ?? '';
  return id.startsWith('price_') ? id : null;
}

/** Whether this server can sell seats to organizations. */
export function isSeatBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY) && seatPriceId() !== null;
}

/** Whether this server can sell plans. */
export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY) && stripePrices() !== null;
}

let client: Stripe | undefined;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set.');
  client ??= new Stripe(key);
  return client;
}

/** How long prices are remembered before Stripe is asked again. */
const PRICE_TTL_MS = 10 * 60 * 1000;
let cached: { at: number; prices: PlanPrice[] } | undefined;

/**
 * What each plan costs, from Stripe, so a price is changed in one place.
 * Empty when billing is not set up or Stripe cannot be reached: the pages
 * then show the plans without prices rather than failing.
 */
export async function planPrices(): Promise<PlanPrice[]> {
  const ids = stripePrices();
  if (!ids || !process.env.STRIPE_SECRET_KEY) return [];
  if (cached && Date.now() - cached.at < PRICE_TTL_MS) return cached.prices;
  try {
    const stripe = getStripe();
    const prices = await Promise.all(
      (['pro_monthly', 'pro_yearly', 'country_pass'] as const).map(async (plan) => {
        const price = await stripe.prices.retrieve(ids[plan]);
        return { plan, amount: price.unit_amount ?? 0, currency: price.currency };
      }),
    );
    cached = { at: Date.now(), prices };
    return prices;
  } catch {
    return cached?.prices ?? [];
  }
}

/** This site's address, for the pages Stripe sends people back to. */
export async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const incoming = await headers();
  const host = incoming.get('x-forwarded-host') ?? incoming.get('host') ?? 'localhost:3000';
  return `${incoming.get('x-forwarded-proto') ?? 'http'}://${host}`;
}

/** The Checkout languages Stripe has for ours; it picks from the browser otherwise. */
const checkoutLocale: Partial<Record<UiLocale, Stripe.Checkout.SessionCreateParams.Locale>> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  pt: 'pt',
  'zh-Hans': 'zh',
  vi: 'vi',
  tl: 'fil',
};

/** Starts a Stripe Checkout for a plan and returns the page to send the learner to. */
export async function createCheckout(input: {
  user: { userId: string; email: string | null };
  purchase: Purchase;
  locale: UiLocale;
  /** Where Stripe returns to, paid or not. */
  returnUrl: string;
}): Promise<string> {
  const prices = stripePrices();
  if (!prices) throw new Error('Stripe prices are not set.');
  const { user, purchase } = input;
  const db = getDb();
  const customer = await stripeCustomerFor(db, user.userId);
  const subscribing = purchase.plan !== 'country_pass';
  // The webhook finds the learner, the plan and the country in this.
  const metadata: Record<string, string> = {
    user_id: user.userId,
    plan: purchase.plan,
    ...(purchase.plan === 'country_pass' ? { country_code: purchase.countryCode } : {}),
  };

  const session = await getStripe().checkout.sessions.create({
    mode: subscribing ? 'subscription' : 'payment',
    line_items: [{ price: prices[purchase.plan], quantity: 1 }],
    client_reference_id: user.userId,
    metadata,
    ...(customer
      ? { customer }
      : {
          customer_email: user.email ?? undefined,
          // A one-off payment makes no customer unless asked; the portal and
          // the next purchase need one.
          ...(subscribing ? {} : { customer_creation: 'always' as const }),
        }),
    ...(subscribing ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
    allow_promotion_codes: true,
    locale: checkoutLocale[input.locale] ?? 'auto',
    success_url: `${input.returnUrl}?purchase=done`,
    cancel_url: input.returnUrl,
  });
  if (!session.url) throw new Error('Stripe did not return a checkout page.');
  if (typeof session.customer === 'string') {
    await linkStripeCustomer(db, user.userId, session.customer);
  }
  return session.url;
}

/** Opens Stripe's customer portal, where a subscription is changed or cancelled. Null if the learner has never bought on the web. */
export async function createPortal(userId: string, returnUrl: string): Promise<string | null> {
  const customer = await stripeCustomerFor(getDb(), userId);
  if (!customer) return null;
  const session = await getStripe().billingPortal.sessions.create({
    customer,
    return_url: returnUrl,
  });
  return session.url;
}

/** What a seat costs, and how often. */
export interface SeatPrice {
  amount: number;
  currency: string;
  interval: 'month' | 'year';
}

let cachedSeat: { at: number; price: SeatPrice } | undefined;

/** The price of a seat, from Stripe. Null when seats are not sold or Stripe cannot be reached. */
export async function seatPrice(): Promise<SeatPrice | null> {
  const id = seatPriceId();
  if (!id || !process.env.STRIPE_SECRET_KEY) return null;
  if (cachedSeat && Date.now() - cachedSeat.at < PRICE_TTL_MS) return cachedSeat.price;
  try {
    const price = await getStripe().prices.retrieve(id);
    cachedSeat = {
      at: Date.now(),
      price: {
        amount: price.unit_amount ?? 0,
        currency: price.currency,
        interval: price.recurring?.interval === 'year' ? 'year' : 'month',
      },
    };
    return cachedSeat.price;
  } catch {
    return cachedSeat?.price ?? null;
  }
}

/** The most seats one checkout sells; more than this is a conversation, not a form. */
export const MAX_SEATS_PER_CHECKOUT = 500;

/**
 * Starts a Stripe Checkout for an organization's seats and returns the page
 * to send the admin to. The subscription belongs to the organization: its
 * own Stripe customer, named in the metadata the webhook reads.
 */
export async function createSeatCheckout(input: {
  user: { userId: string; email: string | null };
  organization: { id: string; name: string };
  seats: number;
  locale: UiLocale;
  returnUrl: string;
}): Promise<string> {
  const price = seatPriceId();
  if (!price) throw new Error('The seat price is not set.');
  const { user, organization } = input;
  const db = getDb();
  const customer = await orgStripeCustomerFor(db, organization.id);
  const metadata = { organization_id: organization.id, plan: 'team', user_id: user.userId };

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price,
        quantity: input.seats,
        adjustable_quantity: { enabled: true, minimum: 1, maximum: MAX_SEATS_PER_CHECKOUT },
      },
    ],
    client_reference_id: user.userId,
    metadata,
    subscription_data: { metadata, description: organization.name },
    ...(customer ? { customer } : { customer_email: user.email ?? undefined }),
    // Organizations pay from a business: let them put its name and tax id on the invoice.
    tax_id_collection: { enabled: true },
    ...(customer ? { customer_update: { name: 'auto' as const, address: 'auto' as const } } : {}),
    allow_promotion_codes: true,
    locale: checkoutLocale[input.locale] ?? 'auto',
    success_url: `${input.returnUrl}?seats=bought`,
    cancel_url: input.returnUrl,
  });
  if (!session.url) throw new Error('Stripe did not return a checkout page.');
  if (typeof session.customer === 'string') {
    await linkOrgStripeCustomer(db, organization.id, session.customer);
  }
  return session.url;
}

/** Opens Stripe's customer portal for an organization: change the number of seats, the card, or cancel. */
export async function createOrgPortal(
  organizationId: string,
  returnUrl: string,
): Promise<string | null> {
  const customer = await orgStripeCustomerFor(getDb(), organizationId);
  if (!customer) return null;
  const session = await getStripe().billingPortal.sessions.create({
    customer,
    return_url: returnUrl,
  });
  return session.url;
}
