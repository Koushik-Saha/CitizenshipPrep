// Rate limits: how often a caller may do something. Fixed windows, counted
// by the server; this file only decides. They sit on top of the daily AI
// allowances in ai-limits.ts, which are about what a plan includes; these are
// about not being hammered.

export interface RateLimitRule {
  /** How many calls a window allows. */
  limit: number;
  windowSeconds: number;
}

export const rateLimitRules = {
  /**
   * Sign-in requests from one network address. Generous, because a classroom
   * or an office signs in from a single address.
   */
  authByAddress: { limit: 30, windowSeconds: 5 * 60 },
  /** Sign-in emails to one address: nobody needs more, and it stops our mail being used to pester. */
  authByEmail: { limit: 5, windowSeconds: 15 * 60 },
  /** AI explanations asked for by one learner. */
  explain: { limit: 20, windowSeconds: 60 },
  /** Tutor messages sent by one learner. */
  tutor: { limit: 10, windowSeconds: 60 },
  /**
   * AI requests of either kind from one network address, whoever the learner
   * is: accounts are free, so the per-learner limits alone would let one
   * machine with many accounts ask without end. Generous, because a classroom
   * shares an address.
   */
  aiByAddress: { limit: 120, windowSeconds: 60 * 60 },
  /** Exam results reported by one learner: a correction or two, not a loop. */
  examResult: { limit: 10, windowSeconds: 60 * 60 },
  /** Tries at the reviewers' password from one network address. */
  adminSignIn: { limit: 10, windowSeconds: 15 * 60 },
  /** Posts one learner starts in the study groups. */
  communityPost: { limit: 5, windowSeconds: 60 * 60 },
  /** Comments one learner writes. */
  communityComment: { limit: 20, windowSeconds: 60 * 60 },
  /**
   * Posts and comments from one network address, whoever writes them: each is
   * read by the model before it is shown, and accounts are free.
   */
  communityByAddress: { limit: 60, windowSeconds: 60 * 60 },
  /** Upvotes given or taken back by one learner. */
  communityVote: { limit: 60, windowSeconds: 60 },
  /** Reports made by one learner: enough to flag a bad thread, not to bury a group. */
  communityReport: { limit: 10, windowSeconds: 60 * 60 },
  /** Attempts to delete an account: the real one needs only one. */
  accountDeletion: { limit: 5, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof rateLimitRules;

/** The start of the window `now` falls in. Windows are aligned to the clock, not to the caller. */
export function rateWindowStart(rule: RateLimitRule, now: Date): Date {
  const size = rule.windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / size) * size);
}

export interface RateDecision {
  allowed: boolean;
  limit: number;
  /** Calls left in this window after this one. */
  remaining: number;
  /** Seconds until the window ends: what a refused caller should wait. */
  retryAfterSeconds: number;
}

/** Whether a call is allowed, given how many the caller has now made in this window, this one included. */
export function rateDecision(rule: RateLimitRule, count: number, now: Date): RateDecision {
  const end = rateWindowStart(rule, now).getTime() + rule.windowSeconds * 1000;
  return {
    allowed: count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((end - now.getTime()) / 1000)),
  };
}

/** The counter a caller's calls are kept under: "explain:user:abc". */
export function rateLimitKey(name: RateLimitName, kind: 'user' | 'address' | 'email', id: string) {
  return `${name}:${kind}:${id}`;
}
