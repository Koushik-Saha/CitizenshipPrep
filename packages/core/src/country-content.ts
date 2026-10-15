// Whether a country's questions are complete enough to sell on their own.
//
// A country is offered to study as soon as its first question is published,
// but a Country Pass sells "every question for one country": that promise is
// only kept once there is a whole country to sell. Until then the country is
// shown as Beta and its pass is not sold (Pro, which is every country, still
// includes it). Decided from the published questions alone, so a country
// leaves Beta by itself once reviewers have published enough.

/** Published questions every topic needs: a topic with fewer is not covered yet. */
export const MIN_TOPIC_QUESTIONS = 10;

/**
 * Where the official question pool is not published, enough different
 * questions for this many full-length mock exams.
 */
export const MOCK_EXAMS_OF_QUESTIONS = 5;

/** What a country's current exams ask for. */
export interface ExamSize {
  /** Questions in one sitting; null where the format has no fixed number. */
  questionCount: number | null;
  /** The official pool the questions are drawn from, where it is published. */
  questionPoolSize: number | null;
}

export interface CountryContent {
  publishedQuestions: number;
  /** Published questions in each of the country's topics, empty topics included. */
  topicQuestions: readonly number[];
  exams: readonly ExamSize[];
}

/**
 * The published questions a country needs: its whole official pool where
 * the pool is public, otherwise enough for MOCK_EXAMS_OF_QUESTIONS different
 * mock exams of its longest test.
 */
export function questionsNeeded(exams: readonly ExamSize[]): number {
  return Math.max(
    0,
    ...exams.map(
      (exam) => exam.questionPoolSize ?? (exam.questionCount ?? 0) * MOCK_EXAMS_OF_QUESTIONS,
    ),
  );
}

/** Whether the country's questions are complete: every topic covered, and enough of them. */
export function isCountryComplete(content: CountryContent): boolean {
  return (
    content.exams.length > 0 &&
    content.topicQuestions.length > 0 &&
    content.topicQuestions.every((count) => count >= MIN_TOPIC_QUESTIONS) &&
    content.publishedQuestions >= questionsNeeded(content.exams)
  );
}
