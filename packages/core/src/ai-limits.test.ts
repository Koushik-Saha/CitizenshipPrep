import { describe, expect, it } from 'vitest';

import {
  aiAllowance,
  aiBudgetAlert,
  aiDailyLimit,
  aiLimits,
  checkQuota,
  DEFAULT_AI_DAILY_LIMIT,
  isSwitchedOn,
  withinAiBudget,
} from './ai-limits';
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

describe('the whole service’s daily limit', () => {
  it('reads a configured limit, and falls back to the default for anything else', () => {
    expect(aiDailyLimit('250')).toBe(250);
    expect(aiDailyLimit(' 0 ')).toBe(0);
    expect(aiDailyLimit(undefined)).toBe(DEFAULT_AI_DAILY_LIMIT);
    expect(aiDailyLimit('')).toBe(DEFAULT_AI_DAILY_LIMIT);
    expect(aiDailyLimit('lots')).toBe(DEFAULT_AI_DAILY_LIMIT);
    expect(aiDailyLimit('-5')).toBe(DEFAULT_AI_DAILY_LIMIT);
    expect(aiDailyLimit('2.5')).toBe(DEFAULT_AI_DAILY_LIMIT);
  });

  it('answers everyone up to the limit, then only Pro, then nobody', () => {
    expect(withinAiBudget('free', 100, 100)).toBe(true);
    expect(withinAiBudget('free', 101, 100)).toBe(false);
    expect(withinAiBudget('pro', 101, 100)).toBe(true);
    expect(withinAiBudget('pro', 200, 100)).toBe(true);
    expect(withinAiBudget('pro', 201, 100)).toBe(false);
    expect(withinAiBudget('free', 1, 0)).toBe(false);
  });

  it('raises the alarm once at 80% and once at the limit', () => {
    expect(aiBudgetAlert(79, 100)).toBeNull();
    expect(aiBudgetAlert(80, 100)).toBe(80);
    expect(aiBudgetAlert(81, 100)).toBeNull();
    expect(aiBudgetAlert(100, 100)).toBe(100);
    expect(aiBudgetAlert(101, 100)).toBeNull();
    expect(aiBudgetAlert(8, 9)).toBe(80);
    expect(aiBudgetAlert(1, 1)).toBe(100);
    expect(aiBudgetAlert(0, 0)).toBeNull();
  });
});

describe('isSwitchedOn', () => {
  it('takes the usual ways of saying yes, and nothing else', () => {
    for (const yes of ['1', 'true', 'TRUE', ' yes ', 'on']) expect(isSwitchedOn(yes)).toBe(true);
    for (const no of [undefined, '', '0', 'false', 'off', 'no'])
      expect(isSwitchedOn(no)).toBe(false);
  });
});
