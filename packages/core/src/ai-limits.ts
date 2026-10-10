// How much AI help each plan includes, and whether a learner has some left.
// Limits are per rolling 24 hours, so there is no midnight rush.

import { hasAccess, type AccessUser } from './access';

/** Which allowance a learner is on. */
export type AiAllowance = 'free' | 'pro';
export type AiFeature = 'explanation' | 'tutor';

export const aiLimits: Record<AiAllowance, Record<AiFeature, number>> = {
  free: { explanation: 20, tutor: 15 },
  pro: { explanation: 200, tutor: 150 },
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** The larger allowance comes with Pro (see hasAccess); everyone else has the free one. */
export function aiAllowance(user: AccessUser, now: Date): AiAllowance {
  return hasAccess(user, 'more_ai', null, now) ? 'pro' : 'free';
}

export interface Quota {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** When the next use frees up; null while there is room. */
  resetsAt: Date | null;
}

/** Whether one more use is allowed, given the times of earlier uses. */
export function checkQuota(
  allowance: AiAllowance,
  feature: AiFeature,
  usedAt: readonly Date[],
  now: Date,
): Quota {
  const limit = aiLimits[allowance][feature];
  const recent = usedAt
    .filter((at) => now.getTime() - at.getTime() < WINDOW_MS)
    .sort((a, b) => a.getTime() - b.getTime());
  const remaining = Math.max(0, limit - recent.length);
  return {
    allowed: remaining > 0,
    limit,
    remaining,
    // The window frees up when the oldest use that counts against the limit expires.
    resetsAt: remaining > 0 ? null : new Date(recent[recent.length - limit]!.getTime() + WINDOW_MS),
  };
}

// The whole service ------------------------------------------------------------------
//
// Accounts are free, so a limit per learner does not bound what the service
// spends. This one does: requests by everyone in the last 24 hours.

/** AI requests the whole service makes in 24 hours, when none is configured. */
export const DEFAULT_AI_DAILY_LIMIT = 5000;

/** The configured daily limit: a whole number of requests, or the default. */
export function aiDailyLimit(configured: string | undefined): number {
  const limit = Number(configured?.trim());
  return configured?.trim() && Number.isSafeInteger(limit) && limit >= 0
    ? limit
    : DEFAULT_AI_DAILY_LIMIT;
}

/**
 * Whether the service still answers this learner, given every request made
 * today including theirs. Past the limit, free accounts wait; past twice the
 * limit, everyone does.
 */
export function withinAiBudget(allowance: AiAllowance, usedToday: number, limit: number): boolean {
  return usedToday <= (allowance === 'pro' ? limit * 2 : limit);
}

/**
 * The share of the daily limit that this request is the first to reach: 80
 * or 100, or null. Whoever runs the service is told at each, once.
 */
export function aiBudgetAlert(usedToday: number, limit: number): 80 | 100 | null {
  if (limit <= 0) return null;
  if (usedToday === limit) return 100;
  return usedToday === Math.ceil(limit * 0.8) ? 80 : null;
}

/** Whether a switch such as DISABLE_AI_TUTOR is on: "1", "true", "yes" or "on". */
export function isSwitchedOn(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
}
