import { describe, expect, it } from 'vitest';

import {
  accessibleQuestions,
  countryPasses,
  freeQuestionIds,
  FREE_QUESTIONS_PER_COUNTRY,
  hasAccess,
  isInForce,
  isPaidPlan,
  proSubscription,
  RENEWAL_GRACE_MS,
  type AccessUser,
  type Entitlement,
} from './access';

const now = new Date('2026-10-06T12:00:00Z');
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

const pro = (overrides: Partial<Entitlement> = {}): Entitlement => ({
  plan: 'pro_monthly',
  countryCode: null,
  status: 'active',
  currentPeriodEnd: inDays(20),
  cancelAtPeriodEnd: false,
  provider: 'stripe',
  ...overrides,
});
const pass = (countryCode: string, overrides: Partial<Entitlement> = {}): Entitlement => ({
  plan: 'country_pass',
  countryCode,
  status: 'active',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  provider: 'app_store',
  ...overrides,
});
const user = (...entitlements: Entitlement[]): AccessUser => ({ entitlements });
const free = user();

describe('hasAccess', () => {
  it('gives the Free plan no paid feature', () => {
    expect(hasAccess(free, 'all_questions', 'US', now)).toBe(false);
    expect(hasAccess(free, 'more_ai', null, now)).toBe(false);
  });

  it('gives Pro everything, in every country, monthly or yearly', () => {
    for (const plan of ['pro_monthly', 'pro_yearly'] as const) {
      const learner = user(pro({ plan }));
      expect(hasAccess(learner, 'all_questions', 'US', now)).toBe(true);
      expect(hasAccess(learner, 'all_questions', 'DE', now)).toBe(true);
      expect(hasAccess(learner, 'more_ai', null, now)).toBe(true);
    }
  });

  it('gives a Country Pass that country’s questions, and nothing else', () => {
    const learner = user(pass('US'));
    expect(hasAccess(learner, 'all_questions', 'US', now)).toBe(true);
    expect(hasAccess(learner, 'all_questions', 'us', now)).toBe(true);
    expect(hasAccess(learner, 'all_questions', 'CA', now)).toBe(false);
    expect(hasAccess(learner, 'all_questions', null, now)).toBe(false);
    expect(hasAccess(learner, 'more_ai', 'US', now)).toBe(false);
    // A pass with no country on it unlocks nothing.
    expect(hasAccess(user(pass('US', { countryCode: null })), 'all_questions', 'US', now)).toBe(
      false,
    );
  });

  it('adds up what a learner holds', () => {
    const learner = user(pass('US'), pass('CA'), pro({ status: 'expired' }));
    expect(hasAccess(learner, 'all_questions', 'CA', now)).toBe(true);
    expect(hasAccess(learner, 'all_questions', 'GB', now)).toBe(false);
    expect(hasAccess(learner, 'more_ai', null, now)).toBe(false);
  });

  it('uses the present time when none is given', () => {
    expect(hasAccess(user(pass('US')), 'all_questions', 'US')).toBe(true);
    expect(isInForce(pass('US'))).toBe(true);
    expect(proSubscription(free)).toBeNull();
    expect(countryPasses(free)).toEqual([]);
    expect(accessibleQuestions(user(pass('US')), 'US', [{ id: 'a', topicId: 't' }])).toHaveLength(
      1,
    );
  });
});

describe('when a subscription counts', () => {
  it('runs while active or on trial, with a short grace past its end date', () => {
    expect(isInForce(pro({ status: 'trialing' }), now)).toBe(true);
    expect(isInForce(pro({ currentPeriodEnd: inDays(-1) }), now)).toBe(true);
    const lapsed = new Date(now.getTime() - RENEWAL_GRACE_MS - 1000).toISOString();
    expect(isInForce(pro({ currentPeriodEnd: lapsed }), now)).toBe(false);
    // Nothing with no end date lapses.
    expect(isInForce(pro({ currentPeriodEnd: null }), now)).toBe(true);
  });

  it('keeps a cancelled subscription to the end of the period paid for, and no longer', () => {
    const cancelling = pro({ cancelAtPeriodEnd: true });
    expect(hasAccess(user(cancelling), 'all_questions', 'US', now)).toBe(true);
    const ended = pro({ status: 'canceled', currentPeriodEnd: inDays(20) });
    // Cancelled, but paid until the 26th: still Pro today, not after.
    expect(isInForce(ended, now)).toBe(true);
    expect(isInForce(ended, new Date(now.getTime() + 21 * 86_400_000))).toBe(false);
    expect(isInForce(pro({ status: 'canceled', currentPeriodEnd: inDays(-1) }), now)).toBe(false);
    expect(isInForce(pro({ status: 'canceled', currentPeriodEnd: null }), now)).toBe(false);
  });

  it('honours a failed payment only inside the period already paid for', () => {
    expect(isInForce(pro({ status: 'past_due' }), now)).toBe(true);
    expect(isInForce(pro({ status: 'past_due', currentPeriodEnd: inDays(-1) }), now)).toBe(false);
    expect(isInForce(pro({ status: 'expired' }), now)).toBe(false);
  });
});

describe('what a learner holds', () => {
  it('finds the Pro subscription that lasts longest', () => {
    const monthly = pro({ currentPeriodEnd: inDays(5) });
    const yearly = pro({ plan: 'pro_yearly', currentPeriodEnd: inDays(200) });
    const forever = pro({ provider: 'manual', currentPeriodEnd: null });
    expect(proSubscription(user(monthly, yearly, pass('US')), now)).toBe(yearly);
    expect(proSubscription(user(yearly, forever, monthly), now)).toBe(forever);
    expect(proSubscription(user(pro({ status: 'expired' }), pass('US')), now)).toBeNull();
  });

  it('lists the countries passes are held for', () => {
    const learner = user(
      pass('us'),
      pass('CA'),
      pass('US'),
      pass('GB', { status: 'canceled' }),
      pass('DE', { countryCode: null }),
      pro(),
    );
    expect(countryPasses(learner, now)).toEqual(['CA', 'US']);
  });

  it('knows a paid plan’s name from anything else', () => {
    expect(isPaidPlan('pro_yearly')).toBe(true);
    expect(isPaidPlan('country_pass')).toBe(true);
    expect(isPaidPlan('free')).toBe(false);
    expect(isPaidPlan('premium')).toBe(false);
  });
});

describe('the free sample', () => {
  const bank = [
    ...Array.from({ length: 30 }, (_, i) => ({
      id: `g${String(i).padStart(2, '0')}`,
      topicId: 'government',
    })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `h${i}`, topicId: 'history' })),
    ...Array.from({ length: 30 }, (_, i) => ({
      id: `s${String(i).padStart(2, '0')}`,
      topicId: 'symbols',
    })),
  ];

  it('is the same questions every time, however the bank is ordered', () => {
    const sample = freeQuestionIds(bank);
    expect(sample.size).toBe(FREE_QUESTIONS_PER_COUNTRY);
    expect(freeQuestionIds([...bank].reverse())).toEqual(sample);
  });

  it('is spread over the topics, taking all of a small one', () => {
    const sample = [...freeQuestionIds(bank)];
    const count = (prefix: string) => sample.filter((id) => id.startsWith(prefix)).length;
    expect([count('g'), count('h'), count('s')]).toEqual([8, 4, 8]);
    expect(sample).toContain('g00');
    expect(sample).not.toContain('g08');
  });

  it('is the whole bank when the bank is small', () => {
    expect(freeQuestionIds(bank.slice(0, 5)).size).toBe(5);
    expect(freeQuestionIds([]).size).toBe(0);
    expect(freeQuestionIds(bank, 3)).toEqual(new Set(['g00', 'h0', 's00']));
  });

  it('is all a Free learner can study; a pass or Pro opens the rest', () => {
    expect(accessibleQuestions(free, 'US', bank, now)).toHaveLength(FREE_QUESTIONS_PER_COUNTRY);
    expect(accessibleQuestions(user(pass('CA')), 'US', bank, now)).toHaveLength(20);
    expect(accessibleQuestions(user(pass('US')), 'US', bank, now)).toHaveLength(64);
    expect(accessibleQuestions(user(pro()), 'US', bank, now)).toEqual(bank);
  });
});
