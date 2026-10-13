// A learner reporting a problem with a question: what they may say is wrong
// with it, and what a report has to look like to be kept.

/** What a learner can say is wrong, in the order the form lists them. */
export const questionReportReasons = ['incorrect', 'outdated', 'unclear', 'typo'] as const;

export type QuestionReportReason = (typeof questionReportReasons)[number];

/** The most a learner can add in their own words. */
export const REPORT_DETAILS_MAX = 500;

export interface QuestionReport {
  reason: QuestionReportReason;
  /** What they added, if anything. */
  details: string | null;
  /** The language they were reading the question in, when the app says. */
  locale: string | null;
}

const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * A report as it arrives from an app, checked. Null when it names no reason
 * we offer. The note is trimmed and cut to length rather than refused: a
 * report that says a little too much is still worth having.
 */
export function parseQuestionReport(input: unknown): QuestionReport | null {
  if (typeof input !== 'object' || input === null) return null;
  const { reason, details, locale } = input as Record<string, unknown>;
  if (
    typeof reason !== 'string' ||
    !(questionReportReasons as readonly string[]).includes(reason)
  ) {
    return null;
  }
  const note = typeof details === 'string' ? details.trim().slice(0, REPORT_DETAILS_MAX) : '';
  return {
    reason: reason as QuestionReportReason,
    details: note || null,
    locale: typeof locale === 'string' && LOCALE.test(locale) ? locale : null,
  };
}
