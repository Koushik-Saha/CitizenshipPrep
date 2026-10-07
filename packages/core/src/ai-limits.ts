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
