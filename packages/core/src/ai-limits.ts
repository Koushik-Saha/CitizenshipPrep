// How much AI help each plan includes, and whether a learner has some left.
// Limits are per rolling 24 hours, so there is no midnight rush.

export type Plan = 'free' | 'premium';
export type AiFeature = 'explanation' | 'tutor';

export const aiLimits: Record<Plan, Record<AiFeature, number>> = {
  free: { explanation: 20, tutor: 15 },
  premium: { explanation: 200, tutor: 150 },
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SubscriptionSummary {
  plan: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  currentPeriodEnd: Date | null;
}

/** Premium while any subscription is trialing, active, or past due but still in its paid period. */
export function planFrom(subscriptions: readonly SubscriptionSummary[], now: Date): Plan {
  const paid = subscriptions.some((subscription) => {
    if (subscription.status === 'trialing' || subscription.status === 'active') return true;
    return (
      subscription.status === 'past_due' &&
      subscription.currentPeriodEnd !== null &&
      subscription.currentPeriodEnd > now
    );
  });
  return paid ? 'premium' : 'free';
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
  plan: Plan,
  feature: AiFeature,
  usedAt: readonly Date[],
  now: Date,
): Quota {
  const limit = aiLimits[plan][feature];
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
