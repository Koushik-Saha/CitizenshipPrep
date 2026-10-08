// The product events worth counting, and what each carries. Nothing here
// identifies a person beyond their account id: no name, no email, no answer.

import type { ExamOutcome } from './exam-result';

export interface AnalyticsEvents {
  /** An account was created. */
  signup: { platform: Platform };
  /** A learner answered their first question ever. */
  first_question_answered: { country: string; platform: Platform };
  /** A mock exam was finished. */
  mock_exam_completed: {
    country: string | null;
    passed: boolean | null;
    correct: number;
    total: number;
    platform: Platform;
  };
  /** A paid plan started: a subscription, a country pass, or seats for an organization. */
  upgrade: { plan: string; provider: string; country: string | null };
  /** A learner said they passed the real exam. */
  pass_reported: { country: string; platform: Platform };
  /** A learner said they did not pass the real exam. */
  fail_reported: { country: string; platform: Platform };
}

export type AnalyticsEventName = keyof AnalyticsEvents;
export type Platform = 'web' | 'mobile';

export const analyticsEventNames = [
  'signup',
  'first_question_answered',
  'mock_exam_completed',
  'upgrade',
  'pass_reported',
  'fail_reported',
] as const satisfies readonly AnalyticsEventName[];

/** The event a reported exam result is counted as. */
export function examResultEvent(result: ExamOutcome): 'pass_reported' | 'fail_reported' {
  return result === 'passed' ? 'pass_reported' : 'fail_reported';
}

/**
 * Which app a request came from: the phone app signs its requests with a
 * token, the website with its session cookie.
 */
export function platformOf(authorization: string | null | undefined): Platform {
  return authorization?.toLowerCase().startsWith('bearer ') ? 'mobile' : 'web';
}
