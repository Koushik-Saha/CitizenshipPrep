// How the real exam went, as the learner reports it.

export const examOutcomes = ['passed', 'failed'] as const;
export type ExamOutcome = (typeof examOutcomes)[number];

export function isExamOutcome(value: unknown): value is ExamOutcome {
  return (examOutcomes as readonly unknown[]).includes(value);
}

export interface ExamStanding {
  /** The exam's date, "YYYY-MM-DD"; null when the learner has not set one. */
  examDate: string | null;
  examResult: ExamOutcome | null;
  /** When the result was reported, as an ISO timestamp. */
  examResultAt: string | null;
}

/**
 * Whether to ask a learner how their exam went: its date has come and they
 * have not said. Someone who did not pass and has set a new date is asked
 * again when that one comes.
 */
export function shouldAskExamResult(standing: ExamStanding, today: string): boolean {
  if (!standing.examDate || standing.examDate > today) return false;
  if (standing.examResult === null || standing.examResultAt === null) return true;
  return standing.examResult === 'failed' && standing.examResultAt.slice(0, 10) < standing.examDate;
}

/** Whether the learner has passed the exam they are studying for. */
export function hasPassedExam(standing: Pick<ExamStanding, 'examResult'>): boolean {
  return standing.examResult === 'passed';
}
