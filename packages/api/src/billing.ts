import {
  countryPasses,
  hasAccess,
  isPaidPlan,
  proSubscription,
  type AccessUser,
  type Entitlement,
  type PaidPlan,
} from '@oathly/core';

// Plans as the apps show and sell them. What a plan unlocks is decided by
// hasAccess in packages/core; this is about what to offer a learner, and how
// to say what something costs. Safe to import anywhere.

/**
 * The plan a store product is, from its identifier. Products are named so
 * that this can tell: "…pro_monthly", "…pro_yearly" (or "annual"), and one
 * Country Pass product per country, "…country_pass_us".
 */
export function planFromProductId(
  productId: string,
): { plan: PaidPlan; countryCode: string | null } | null {
  const id = productId.toLowerCase();
  const pass = /country_pass[._-]([a-z]{2})(?:$|[.:])/.exec(id);
  if (pass) return { plan: 'country_pass', countryCode: pass[1]!.toUpperCase() };
  if (/year|annual/.test(id)) return { plan: 'pro_yearly', countryCode: null };
  if (/month/.test(id)) return { plan: 'pro_monthly', countryCode: null };
  return null;
}

/** What a plan costs, as the payment provider reports it. */
export interface PlanPrice {
  plan: PaidPlan;
  /** In the currency's smallest unit: cents, pence, yen. */
  amount: number;
  /** ISO 4217, any case. */
  currency: string;
}

/** A price as the payment provider describes it (Stripe's fields): what a checkout with it charges. */
export interface ProviderPrice {
  active: boolean;
  /** Null for prices with no fixed amount (tiered, metered, pay what you want). */
  unit_amount: number | null;
  currency: string;
  /** 'one_time' or 'recurring'; anything else is not a price a plan can be sold at. */
  type: string;
  recurring: { interval: string; interval_count: number } | null;
}

/** How often each plan is charged: every month, every year, or once. */
const billedEvery: Record<PaidPlan, { interval: 'month' | 'year'; count: 1 } | 'once'> = {
  pro_monthly: { interval: 'month', count: 1 },
  pro_yearly: { interval: 'year', count: 1 },
  country_pass: 'once',
};

/**
 * What `plan` costs, read from the price that sells it, or null when that
 * price would not charge what the plan's label says: archived, without a
 * fixed amount, or billed on another schedule (a "monthly" price that is
 * yearly, a pass that renews). The pages show a plan's price next to its
 * buy button and the checkout charges that same price, so a plan whose price
 * is null is shown as not on sale rather than with a wrong label.
 */
export function planPriceFrom(plan: PaidPlan, price: ProviderPrice): PlanPrice | null {
  const amount = price.unit_amount;
  if (!price.active || amount === null || !Number.isInteger(amount) || amount <= 0) return null;
  const expected = billedEvery[plan];
  const matches =
    expected === 'once'
      ? price.type === 'one_time'
      : price.type === 'recurring' &&
        price.recurring?.interval === expected.interval &&
        price.recurring.interval_count === expected.count;
  return matches ? { plan, amount, currency: price.currency } : null;
}

/** A price in the reader's language: "$7.99", "7,99 €", "¥800". */
export function formatPrice(price: Pick<PlanPrice, 'amount' | 'currency'>, locale: string): string {
  const format = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: price.currency.toUpperCase(),
  });
  // The currency says how many decimal places its smallest unit is.
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(price.amount / 10 ** digits);
}

/** What a learner holds, and what is left to offer them. */
export interface PlanSummary {
  /** The Pro subscription in force, if any. */
  pro: Entitlement | null;
  /** Countries held by a Country Pass. */
  passes: string[];
  /** Pro can be bought: there is none in force. */
  canBuyPro: boolean;
  /** Countries the learner studies that neither Pro nor a pass opens yet, and whose pass is sold. */
  passCountries: string[];
  /**
   * Countries the learner studies that are not open yet, whose questions are
   * still being completed (Beta): their pass is not sold, but Pro opens them.
   */
  betaCountries: string[];
}

/**
 * A half-built country is not sold on its own: a country whose `complete` is
 * false goes in betaCountries, not passCountries. One that does not say is
 * taken as complete (an older saved copy); the checkout asks the server again.
 */
export function planSummary(
  user: AccessUser,
  studyCountries: readonly { countryCode: string; complete?: boolean }[],
  now: Date = new Date(),
): PlanSummary {
  const pro = proSubscription(user, now);
  const closed = studyCountries.filter(
    (country) => !hasAccess(user, 'all_questions', country.countryCode, now),
  );
  return {
    pro,
    passes: countryPasses(user, now),
    canBuyPro: pro === null,
    passCountries: closed
      .filter((country) => country.complete !== false)
      .map((country) => country.countryCode),
    betaCountries: closed
      .filter((country) => country.complete === false)
      .map((country) => country.countryCode),
  };
}

/**
 * The plan a buy button named, as it travels in an address (?plan=) from the
 * landing page through sign-in. Null for anything else: it is typed by
 * whoever wrote the link.
 */
export function parsePlanChoice(value: unknown): PaidPlan | null {
  return typeof value === 'string' && isPaidPlan(value) ? value : null;
}

/**
 * The plans page, at the part that sells the plan someone picked. The page
 * is where a purchase starts: its buttons open the checkout.
 */
export function plansPath(plan?: PaidPlan | null): string {
  if (!plan) return '/study/plans';
  return `/study/plans?plan=${plan}#${plan === 'country_pass' ? 'pass' : 'pro'}`;
}

/**
 * The page of the Stripe dashboard for something Stripe gave an id to: a
 * customer, a subscription or a payment. That is where a refund is made.
 * Null for an id with no page of its own. `live` is whether the server's key
 * is a live one: test and live data are kept apart there.
 */
export function stripeDashboardUrl(id: string, live: boolean): string | null {
  const section = id.startsWith('cus_')
    ? 'customers'
    : id.startsWith('sub_')
      ? 'subscriptions'
      : id.startsWith('pi_') || id.startsWith('ch_') || id.startsWith('py_')
        ? 'payments'
        : null;
  if (!section || !/^[a-z]+_[A-Za-z0-9]+$/.test(id)) return null;
  return `https://dashboard.stripe.com/${live ? '' : 'test/'}${section}/${id}`;
}

/**
 * What a checkout says and asks for besides the price, as Stripe Checkout
 * takes it:
 *
 * - Above the pay button, always: that paying accepts the terms and the
 *   refund policy, and asks for access to start at once. Buyers in the EU
 *   and the UK have 14 days to withdraw from an online purchase unless they
 *   ask for it to start straight away, so they are told that they are asking.
 * - With `collectTax`: Stripe works out the VAT, GST or sales tax owed where
 *   the buyer lives, which needs their address. Stripe Tax has to be set up
 *   in the Stripe dashboard first, or Stripe refuses the checkout.
 * - With `requireConsent`: a box the buyer must tick to accept the terms.
 *   The address of the terms has to be set in the Stripe dashboard first.
 *
 * `existingCustomer` is whether the buyer is already a Stripe customer: their
 * address is then saved to that customer, which Stripe needs to tax them.
 */
export function checkoutTerms(options: {
  termsUrl: string;
  refundsUrl: string;
  collectTax: boolean;
  requireConsent: boolean;
  existingCustomer: boolean;
}) {
  const agreement =
    `By paying you agree to Oathly's [terms](${options.termsUrl}) and ` +
    `[refund policy](${options.refundsUrl}), and ask for access to start now. ` +
    'If the law where you live gives you 14 days to withdraw, starting now can end that ' +
    'right once access has begun.';
  return {
    custom_text: {
      submit: { message: agreement },
      ...(options.requireConsent
        ? {
            terms_of_service_acceptance: {
              message: `I agree to Oathly's [terms](${options.termsUrl}) and [refund policy](${options.refundsUrl}).`,
            },
          }
        : {}),
    },
    ...(options.requireConsent
      ? { consent_collection: { terms_of_service: 'required' as const } }
      : {}),
    ...(options.collectTax
      ? {
          automatic_tax: { enabled: true },
          billing_address_collection: 'required' as const,
          ...(options.existingCustomer
            ? { customer_update: { address: 'auto' as const, name: 'auto' as const } }
            : {}),
        }
      : {}),
  };
}

/** What can be bought, as a checkout request names it. */
export type Purchase =
  { plan: 'pro_monthly' | 'pro_yearly' } | { plan: 'country_pass'; countryCode: string };

/**
 * Why a learner should not be sold something, or null if they may buy it.
 * Selling Pro twice, or a pass for a country already open, takes money for
 * nothing.
 */
export function purchaseProblem(
  user: AccessUser,
  purchase: Purchase,
  now: Date = new Date(),
): 'already-pro' | 'already-open' | null {
  if (purchase.plan !== 'country_pass') {
    return proSubscription(user, now) ? 'already-pro' : null;
  }
  return hasAccess(user, 'all_questions', purchase.countryCode, now) ? 'already-open' : null;
}
