import { describe, expect, it } from 'vitest';

import { rateDecision, rateLimitKey, rateLimitRules, rateWindowStart } from './rate-limit';

const rule = { limit: 3, windowSeconds: 60 };
const at = (time: string) => new Date(`2026-10-08T${time}Z`);

describe('rateWindowStart', () => {
  it('aligns windows to the clock', () => {
    expect(rateWindowStart(rule, at('10:15:42.500'))).toEqual(at('10:15:00.000'));
    expect(rateWindowStart(rule, at('10:15:00.000'))).toEqual(at('10:15:00.000'));
    expect(rateWindowStart({ limit: 5, windowSeconds: 900 }, at('10:29:59'))).toEqual(
      at('10:15:00'),
    );
  });
});

describe('rateDecision', () => {
  it('allows calls up to the limit and counts down what is left', () => {
    expect(rateDecision(rule, 1, at('10:15:10'))).toEqual({
      allowed: true,
      limit: 3,
      remaining: 2,
      retryAfterSeconds: 50,
    });
    expect(rateDecision(rule, 3, at('10:15:10'))).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('refuses the call after the limit and says how long to wait', () => {
    expect(rateDecision(rule, 4, at('10:15:42.500'))).toEqual({
      allowed: false,
      limit: 3,
      remaining: 0,
      retryAfterSeconds: 18,
    });
  });

  it('never tells a caller to retry at once', () => {
    expect(rateDecision(rule, 9, at('10:15:59.999')).retryAfterSeconds).toBe(1);
    expect(rateDecision(rule, 9, at('10:15:00.000')).retryAfterSeconds).toBe(60);
  });
});

describe('rateLimitKey', () => {
  it('keeps each kind of caller and each limit apart', () => {
    expect(rateLimitKey('explain', 'user', 'abc')).toBe('explain:user:abc');
    expect(rateLimitKey('authByAddress', 'address', '9f2c')).toBe('authByAddress:address:9f2c');
  });
});

describe('rateLimitRules', () => {
  it('lets a classroom sign in from one address, but not mail one inbox over and over', () => {
    expect(rateLimitRules.authByAddress.limit).toBeGreaterThanOrEqual(30);
    expect(rateLimitRules.authByEmail.limit).toBeLessThanOrEqual(5);
  });
});
