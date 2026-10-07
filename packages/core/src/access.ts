// Plans and what they unlock. Every "may this learner have that?" question
// in either app, and on the server, is answered by hasAccess below, so the
// rules live in exactly one place.
//
//   Free          a sample of each country's questions
//   Pro           everything, in every country, while the subscription runs
//                 (monthly or yearly: the same access, billed differently)
//   Country Pass  everything for one country, bought once, kept for good

export const paidPlans = ['pro_monthly', 'pro_yearly', 'country_pass'] as const;
export type PaidPlan = (typeof paidPlans)[number];

export function isPaidPlan(value: string): value is PaidPlan {
  return (paidPlans as readonly string[]).includes(value);
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';

/** One thing a learner has paid for, as the subscriptions table records it. */
export interface Entitlement {
  plan: PaidPlan;
  /** The country a Country Pass is for; null for Pro. */
  countryCode: string | null;
  status: SubscriptionStatus;
  /** When the paid period ends (ISO 8601); null for something with no end, like a pass. */
  currentPeriodEnd: string | null;
  /** The learner has cancelled: it will not renew when the period ends. */
  cancelAtPeriodEnd: boolean;
  /** Where it was bought, which is also where it is managed. */
  provider: 'stripe' | 'app_store' | 'play_store' | 'manual';
}

/** The part of a user that access depends on. */
export interface AccessUser {
  entitlements: readonly Entitlement[];
}

/** What a plan can unlock. */
export type Feature =
  /** Every published question of a country, rather than the free sample. */
  | 'all_questions'
  /** The larger daily allowance of AI explanations and tutor messages. */
  | 'more_ai';

/** Which paid plans unlock each feature. Free unlocks none of them. */
const unlockedBy: Record<Feature, { pro: boolean; countryPass: boolean }> = {
  all_questions: { pro: true, countryPass: true },
  // A pass is paid for once, and AI costs something every time it is used.
  more_ai: { pro: true, countryPass: false },
};

/** How many of a country's questions the Free plan includes. */
export const FREE_QUESTIONS_PER_COUNTRY = 20;

/**
 * How long past its end date a running subscription is still honoured. The
 * end date moves forward when a renewal is reported; if that report is late
 * or lost, the learner should not be locked out the same minute.
 */
export const RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/** Whether something paid for is in force at `now`. */
export function isInForce(entitlement: Entitlement, now: Date = new Date()): boolean {
  const end =
    entitlement.currentPeriodEnd === null ? null : Date.parse(entitlement.currentPeriodEnd);
  switch (entitlement.status) {
    case 'trialing':
    case 'active':
      return end === null || now.getTime() <= end + RENEWAL_GRACE_MS;
    case 'past_due':
    case 'canceled':
      // Paid up to a date: good until then, and not a moment after.
      return end !== null && now.getTime() < end;
    case 'expired':
      return false;
  }
}

const isPro = (entitlement: Entitlement) =>
  entitlement.plan === 'pro_monthly' || entitlement.plan === 'pro_yearly';

/**
 * Whether a learner may use a feature. `country` is the ISO code of the
 * country in question, or null for features that are not about one.
 */
export function hasAccess(
  user: AccessUser,
  feature: Feature,
  country: string | null,
  now: Date = new Date(),
): boolean {
  const rule = unlockedBy[feature];
  return user.entitlements.some((entitlement) => {
    if (!isInForce(entitlement, now)) return false;
    if (isPro(entitlement)) return rule.pro;
    return (
      rule.countryPass &&
      country !== null &&
      entitlement.countryCode?.toUpperCase() === country.toUpperCase()
    );
  });
}

/** The Pro subscription in force, if any: the one that lasts longest. */
export function proSubscription(user: AccessUser, now: Date = new Date()): Entitlement | null {
  const end = (entitlement: Entitlement) =>
    entitlement.currentPeriodEnd === null ? Infinity : Date.parse(entitlement.currentPeriodEnd);
  return (
    user.entitlements
      .filter((entitlement) => isPro(entitlement) && isInForce(entitlement, now))
      .sort((a, b) => end(b) - end(a))[0] ?? null
  );
}

/** The countries a learner holds a Country Pass for. */
export function countryPasses(user: AccessUser, now: Date = new Date()): string[] {
  return [
    ...new Set(
      user.entitlements
        .filter(
          (entitlement) =>
            entitlement.plan === 'country_pass' &&
            entitlement.countryCode !== null &&
            isInForce(entitlement, now),
        )
        .map((entitlement) => entitlement.countryCode!.toUpperCase()),
    ),
  ].sort();
}

/**
 * The questions of a country that the Free plan includes: the same ones every
 * time, spread evenly over the country's topics so the sample is a fair
 * picture of the exam.
 */
export function freeQuestionIds(
  questions: readonly { id: string; topicId: string }[],
  limit: number = FREE_QUESTIONS_PER_COUNTRY,
): Set<string> {
  const byTopic = new Map<string, string[]>();
  for (const question of [...questions].sort((a, b) => a.id.localeCompare(b.id))) {
    byTopic.set(question.topicId, [...(byTopic.get(question.topicId) ?? []), question.id]);
  }
  const topics = [...byTopic.keys()].sort().map((topic) => byTopic.get(topic)!);
  const free = new Set<string>();
  // One from each topic in turn, until the sample is full or the bank is empty.
  for (let round = 0; free.size < limit && topics.some((ids) => round < ids.length); round += 1) {
    for (const ids of topics) {
      if (free.size < limit && round < ids.length) free.add(ids[round]!);
    }
  }
  return free;
}

/** The questions of a country this learner may study: all of them, or the free sample. */
export function accessibleQuestions<Q extends { id: string; topicId: string }>(
  user: AccessUser,
  country: string,
  questions: readonly Q[],
  now: Date = new Date(),
): Q[] {
  if (hasAccess(user, 'all_questions', country, now)) return [...questions];
  const free = freeQuestionIds(questions);
  return questions.filter((question) => free.has(question.id));
}
