import { checkoutTerms, planPriceFrom, type PlanPrice, type Purchase } from '@oathly/api/billing';
import {
  applySubscriptionChange,
  changeFromStripeSubscription,
  linkOrgStripeCustomer,
  linkStripeCustomer,
  orgStripeCustomerFor,
  stripeCustomerFor,
  stripeProSubscriptionFor,
  type StripePrices,
} from '@oathly/api/server';
import { isSwitchedOn, paidPlans, type PaidPlan } from '@oathly/core';
import type { UiLocale } from '@oathly/i18n';
import { headers } from 'next/headers';
import Stripe from 'stripe';

import { getDb } from './db';
import { reportError } from './monitoring';

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

/** Whether the server's Stripe key is a live one: the dashboard keeps test and live data apart. */
export function isStripeLive(): boolean {
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? '');
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
 * What each plan costs, from Stripe, so a price is changed in one place: the
 * pages show these and the checkout charges the same prices. A plan whose
 * Stripe price does not charge what its label says (planPriceFrom) is left
 * out and reported, and is then not sold. Empty when billing is not set up
 * or Stripe cannot be reached: the pages then show the plans without prices
 * or buy buttons rather than failing.
 */
export async function planPrices(): Promise<PlanPrice[]> {
  const ids = stripePrices();
  if (!ids || !process.env.STRIPE_SECRET_KEY) return [];
  if (cached && Date.now() - cached.at < PRICE_TTL_MS) return cached.prices;
  try {
    const stripe = getStripe();
    const found = await Promise.all(
      paidPlans.map(async (plan) => {
        const price = planPriceFrom(plan, await stripe.prices.retrieve(ids[plan]));
        if (!price) {
          reportError(
            new Error(`The Stripe price set for ${plan} does not charge what the plan says.`),
            {
              where: 'billing-prices',
              plan,
            },
          );
        }
        return price;
      }),
    );
    const prices = found.filter((price) => price !== null);
    cached = { at: Date.now(), prices };
    return prices;
  } catch (error) {
    reportError(error, { where: 'billing-prices' });
    return cached?.prices ?? [];
  }
}

/** Whether `plan` can be bought now: billing is set up and its price is known. */
export function isOnSale(prices: readonly PlanPrice[], plan: PaidPlan): boolean {
  return isBillingConfigured() && prices.some((price) => price.plan === plan);
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

/**
 * What every checkout says and asks for besides the price (checkoutTerms in
 * @oathly/api). The agreement above the pay button is always there. Tax and
 * the tick box each need something set up in the Stripe dashboard first, so
 * each is switched on from the environment once that is done:
 * STRIPE_TAX=1 (Stripe Tax is on), STRIPE_TERMS_CONSENT=1 (the address of the
 * terms is in Stripe's public details).
 */
async function checkoutExtras(existingCustomer: boolean) {
  const origin = await siteOrigin();
  return checkoutTerms({
    termsUrl: `${origin}/terms`,
    refundsUrl: `${origin}/refunds`,
    collectTax: isSwitchedOn(process.env.STRIPE_TAX),
    requireConsent: isSwitchedOn(process.env.STRIPE_TERMS_CONSENT),
    existingCustomer,
  });
}

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
    ...(await checkoutExtras(Boolean(customer))),
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

/**
 * Cancels the learner's own Pro subscription at the end of the period they
 * have paid for, or (`cancel: false`) takes that back so it renews. Nothing
 * is refunded and nothing is taken away now: Pro runs to the date already
 * paid up to. False when they hold no web subscription to change.
 *
 * Stripe also reports the change by webhook; it is written here as well so
 * the page the learner returns to already shows it.
 */
export async function setPlanCancellation(userId: string, cancel: boolean): Promise<boolean> {
  const prices = stripePrices();
  if (!prices) return false;
  const db = getDb();
  // Found by the learner's id: nobody can name someone else's subscription.
  const subscriptionId = await stripeProSubscriptionFor(db, userId);
  if (!subscriptionId) return false;
  const subscription = await getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: cancel,
  });
  const change = changeFromStripeSubscription(
    subscription as unknown as Record<string, unknown>,
    prices,
    new Date(),
  );
  if (change) await applySubscriptionChange(db, { ...change, userId });
  return true;
}

/**
 * A payment refunded in full ends what it paid for, as the Refunds page
 * says. A Country Pass is ended by the webhook itself, which recorded its
 * payment. A payment towards a subscription (Pro, or an organization's
 * seats) names its subscription only through the invoice it paid, which is
 * asked of Stripe here, and that subscription is cancelled at once: it is not
 * renewed and charged again. Stripe then reports the subscription ended, and
 * the webhook takes the plan away as for any other ending. Returns whether a
 * subscription was cancelled.
 */
export async function endRefundedSubscription(paymentIntentId: string): Promise<boolean> {
  const stripe = getStripe();
  const payments = await stripe.invoicePayments.list({
    payment: { type: 'payment_intent', payment_intent: paymentIntentId },
    expand: ['data.invoice'],
    limit: 1,
  });
  const invoice = payments.data[0]?.invoice;
  const subscription =
    invoice && typeof invoice === 'object' && !('deleted' in invoice)
      ? invoice.parent?.subscription_details?.subscription
      : null;
  const subscriptionId = typeof subscription === 'string' ? subscription : subscription?.id;
  if (!subscriptionId) return false;
  const current = await stripe.subscriptions.retrieve(subscriptionId);
  if (current.status === 'canceled' || current.status === 'incomplete_expired') return false;
  await stripe.subscriptions.cancel(subscriptionId);
  return true;
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
    ...(await checkoutExtras(Boolean(customer))),
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
