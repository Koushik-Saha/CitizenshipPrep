import {
  countryPasses,
  hasAccess,
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
  /** Countries the learner studies that neither Pro nor a pass opens yet. */
  passCountries: string[];
}

export function planSummary(
  user: AccessUser,
  studyCountries: readonly string[],
  now: Date = new Date(),
): PlanSummary {
  const pro = proSubscription(user, now);
  return {
    pro,
    passes: countryPasses(user, now),
    canBuyPro: pro === null,
    passCountries: studyCountries.filter(
      (country) => !hasAccess(user, 'all_questions', country, now),
    ),
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
