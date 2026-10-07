import { describe, expect, it } from 'vitest';

import { aiAllowance, aiLimits, checkQuota } from './ai-limits';
import { at } from './test-fixtures';

const now = at('2026-10-04T12:00:00Z');
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

describe('aiAllowance', () => {
  const pro = {
    plan: 'pro_yearly',
    countryCode: null,
    status: 'active',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    provider: 'stripe',
  } as const;

  it('is the larger one with Pro, and the free one otherwise', () => {
    expect(aiAllowance({ entitlements: [] }, now)).toBe('free');
    expect(aiAllowance({ entitlements: [pro] }, now)).toBe('pro');
    expect(
      aiAllowance({ entitlements: [{ ...pro, plan: 'country_pass', countryCode: 'US' }] }, now),
    ).toBe('free');
    expect(aiAllowance({ entitlements: [{ ...pro, status: 'expired' }] }, now)).toBe('free');
  });
});

describe('checkQuota', () => {
  it('allows use while under the limit', () => {
    expect(checkQuota('free', 'tutor', [hoursAgo(1)], now)).toEqual({
      allowed: true,
      limit: 15,
      remaining: 14,
      resetsAt: null,
    });
  });

  it('only counts the last 24 hours', () => {
    const old = Array.from({ length: 15 }, () => hoursAgo(25));
    expect(checkQuota('free', 'tutor', old, now).remaining).toBe(15);
  });

  it('refuses at the limit and says when room frees up', () => {
    const used = Array.from({ length: aiLimits.free.explanation }, (_, i) =>
      hoursAgo(20 - i * 0.5),
    );
    const quota = checkQuota('free', 'explanation', used, now);
    expect(quota).toMatchObject({ allowed: false, remaining: 0 });
    expect(quota.resetsAt).toEqual(new Date(hoursAgo(20).getTime() + 24 * 60 * 60 * 1000));
  });

  it('gives premium learners more', () => {
    const used = Array.from({ length: 20 }, () => hoursAgo(1));
    expect(checkQuota('free', 'explanation', used, now).allowed).toBe(false);
    expect(checkQuota('pro', 'explanation', used, now)).toMatchObject({
      allowed: true,
      remaining: 180,
    });
  });
});
