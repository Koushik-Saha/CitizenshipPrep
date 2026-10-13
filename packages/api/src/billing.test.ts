import type { Entitlement } from '@oathly/core';
import { describe, expect, it } from 'vitest';

import {
  checkoutTerms,
  formatPrice,
  parsePlanChoice,
  planFromProductId,
  plansPath,
  stripeDashboardUrl,
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

describe('what a checkout says and asks for', () => {
  const urls = {
    termsUrl: 'https://oathly.example/terms',
    refundsUrl: 'https://oathly.example/refunds',
  };

  it('always says that paying accepts the terms and asks for access to start now', () => {
    const plain = checkoutTerms({
      ...urls,
      collectTax: false,
      requireConsent: false,
      existingCustomer: false,
    });
    expect(Object.keys(plain)).toEqual(['custom_text']);
    const { message } = plain.custom_text.submit;
    expect(message).toContain('[terms](https://oathly.example/terms)');
    expect(message).toContain('[refund policy](https://oathly.example/refunds)');
    expect(message).toContain('ask for access to start now');
    expect(message).toContain('14 days to withdraw');
    // Stripe takes at most 1,200 characters here.
    expect(message.length).toBeLessThan(1200);
  });

  it('asks for a ticked box when consent is required', () => {
    const asked = checkoutTerms({
      ...urls,
      collectTax: false,
      requireConsent: true,
      existingCustomer: false,
    });
    expect(asked.consent_collection).toEqual({ terms_of_service: 'required' });
    expect(asked.custom_text.terms_of_service_acceptance!.message).toContain(
      '[terms](https://oathly.example/terms)',
    );
    expect(asked).not.toHaveProperty('automatic_tax');
  });

  it('has Stripe work out the tax from the buyer’s address when tax is collected', () => {
    const fresh = checkoutTerms({
      ...urls,
      collectTax: true,
      requireConsent: false,
      existingCustomer: false,
    });
    expect(fresh.automatic_tax).toEqual({ enabled: true });
    expect(fresh.billing_address_collection).toBe('required');
    expect(fresh).not.toHaveProperty('customer_update');
    expect(fresh).not.toHaveProperty('consent_collection');
    // Someone who has bought before: the address is saved to the customer Stripe already has.
    const returning = checkoutTerms({
      ...urls,
      collectTax: true,
      requireConsent: true,
      existingCustomer: true,
    });
    expect(returning.customer_update).toEqual({ address: 'auto', name: 'auto' });
    expect(returning.consent_collection).toEqual({ terms_of_service: 'required' });
  });
});

describe('a link to the Stripe dashboard', () => {
  it('goes to the page for a customer, a subscription or a payment', () => {
    expect(stripeDashboardUrl('cus_123abc', true)).toBe(
      'https://dashboard.stripe.com/customers/cus_123abc',
    );
    expect(stripeDashboardUrl('sub_123abc', false)).toBe(
      'https://dashboard.stripe.com/test/subscriptions/sub_123abc',
    );
    expect(stripeDashboardUrl('pi_123abc', false)).toBe(
      'https://dashboard.stripe.com/test/payments/pi_123abc',
    );
    expect(stripeDashboardUrl('ch_123abc', true)).toBe(
      'https://dashboard.stripe.com/payments/ch_123abc',
    );
    expect(stripeDashboardUrl('py_123abc', true)).toContain('/payments/py_123abc');
  });

  it('is not made for an id with no page, or for anything that is not an id', () => {
    expect(stripeDashboardUrl('cs_test_123', false)).toBeNull();
    expect(stripeDashboardUrl('1000000123456789', true)).toBeNull();
    expect(stripeDashboardUrl('cus_123/../../x', true)).toBeNull();
    expect(stripeDashboardUrl('', true)).toBeNull();
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
