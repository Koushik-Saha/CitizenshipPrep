import { describe, expect, it } from 'vitest';

import { aiLimits, checkQuota, planFrom } from './ai-limits';
import { at } from './test-fixtures';

const now = at('2026-10-04T12:00:00Z');
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

describe('planFrom', () => {
  it('is free without a subscription', () => {
    expect(planFrom([], now)).toBe('free');
  });

  it('is premium while trialing or active', () => {
    expect(planFrom([{ plan: 'premium', status: 'active', currentPeriodEnd: null }], now)).toBe(
      'premium',
    );
    expect(planFrom([{ plan: 'premium', status: 'trialing', currentPeriodEnd: null }], now)).toBe(
      'premium',
    );
  });

  it('keeps premium for a late payment only until the paid period ends', () => {
    expect(
      planFrom(
        [{ plan: 'premium', status: 'past_due', currentPeriodEnd: at('2026-10-05T00:00:00Z') }],
        now,
      ),
    ).toBe('premium');
    expect(
      planFrom(
        [{ plan: 'premium', status: 'past_due', currentPeriodEnd: at('2026-10-01T00:00:00Z') }],
        now,
      ),
    ).toBe('free');
    expect(planFrom([{ plan: 'premium', status: 'past_due', currentPeriodEnd: null }], now)).toBe(
      'free',
    );
  });

  it('is free once canceled or expired', () => {
    expect(
      planFrom(
        [
          { plan: 'premium', status: 'canceled', currentPeriodEnd: null },
          { plan: 'premium', status: 'expired', currentPeriodEnd: null },
        ],
        now,
      ),
    ).toBe('free');
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
    expect(checkQuota('premium', 'explanation', used, now)).toMatchObject({
      allowed: true,
      remaining: 180,
    });
  });
});
