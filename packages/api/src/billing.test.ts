import type { Entitlement } from '@oathly/core';
import { describe, expect, it } from 'vitest';

import {
  formatPrice,
  parsePlanChoice,
  planFromProductId,
  plansPath,
  planSummary,
  purchaseProblem,
} from './billing';

const now = new Date('2026-10-06T12:00:00Z');
const pro: Entitlement = {
  plan: 'pro_yearly',
  countryCode: null,
  status: 'active',
  currentPeriodEnd: '2027-10-06T12:00:00.000Z',
  cancelAtPeriodEnd: false,
  provider: 'stripe',
};
const pass = (countryCode: string): Entitlement => ({
  ...pro,
  plan: 'country_pass',
  countryCode,
  currentPeriodEnd: null,
});

describe('formatPrice', () => {
  it('writes a price the way the reader’s language does', () => {
    expect(formatPrice({ amount: 799, currency: 'usd' }, 'en')).toBe('$7.99');
    expect(formatPrice({ amount: 799, currency: 'EUR' }, 'fr')).toMatch(/^7,99\s€$/);
    // Yen has no smaller unit.
    expect(formatPrice({ amount: 800, currency: 'jpy' }, 'en')).toBe('¥800');
  });
});

describe('planSummary', () => {
  it('offers a Free learner Pro, and a pass for each country they study', () => {
    expect(planSummary({ entitlements: [] }, ['US', 'CA'], now)).toEqual({
      pro: null,
      passes: [],
      canBuyPro: true,
      passCountries: ['US', 'CA'],
    });
  });

  it('offers a pass only for countries not already open', () => {
    const summary = planSummary({ entitlements: [pass('US')] }, ['US', 'CA'], now);
    expect(summary).toMatchObject({ passes: ['US'], canBuyPro: true, passCountries: ['CA'] });
  });

  it('offers a Pro learner nothing more', () => {
    expect(planSummary({ entitlements: [pro] }, ['US', 'CA'], now)).toEqual({
      pro,
      passes: [],
      canBuyPro: false,
      passCountries: [],
    });
    expect(planSummary({ entitlements: [] }, []).canBuyPro).toBe(true);
  });
});

describe('purchaseProblem', () => {
  it('will not sell what is already held', () => {
    const free = { entitlements: [] };
    expect(purchaseProblem(free, { plan: 'pro_monthly' }, now)).toBeNull();
    expect(purchaseProblem(free, { plan: 'country_pass', countryCode: 'US' }, now)).toBeNull();
    expect(purchaseProblem({ entitlements: [pro] }, { plan: 'pro_yearly' }, now)).toBe(
      'already-pro',
    );
    expect(
      purchaseProblem({ entitlements: [pro] }, { plan: 'country_pass', countryCode: 'US' }, now),
    ).toBe('already-open');
    const held = { entitlements: [pass('US')] };
    expect(purchaseProblem(held, { plan: 'country_pass', countryCode: 'US' }, now)).toBe(
      'already-open',
    );
    expect(purchaseProblem(held, { plan: 'country_pass', countryCode: 'CA' })).toBeNull();
    // A pass does not stop someone upgrading to Pro.
    expect(purchaseProblem(held, { plan: 'pro_monthly' }, now)).toBeNull();
  });
});

describe('a plan picked on a buy button', () => {
  it('is read from an address only when it names a plan that is sold', () => {
    expect(parsePlanChoice('pro_yearly')).toBe('pro_yearly');
    expect(parsePlanChoice('country_pass')).toBe('country_pass');
    expect(parsePlanChoice('team')).toBeNull();
    expect(parsePlanChoice('https://elsewhere.example')).toBeNull();
    expect(parsePlanChoice(['pro_yearly'])).toBeNull();
    expect(parsePlanChoice(undefined)).toBeNull();
  });

  it('leads to the part of the plans page that sells it', () => {
    expect(plansPath('pro_monthly')).toBe('/study/plans?plan=pro_monthly#pro');
    expect(plansPath('pro_yearly')).toBe('/study/plans?plan=pro_yearly#pro');
    expect(plansPath('country_pass')).toBe('/study/plans?plan=country_pass#pass');
    expect(plansPath()).toBe('/study/plans');
    expect(plansPath(null)).toBe('/study/plans');
  });
});

describe('planFromProductId', () => {
  it('is shared with the server, which reads the same names from webhooks', () => {
    expect(planFromProductId('oathly_country_pass_us')).toEqual({
      plan: 'country_pass',
      countryCode: 'US',
    });
  });
});
