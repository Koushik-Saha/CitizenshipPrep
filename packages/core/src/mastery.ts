import type { AnswerEvent, QuizQuestion } from './types';

// Spaced repetition in the style of SM-2, and per-topic mastery derived from
// it. Everything is computed from the answer history, so it can be rebuilt at
// any time from answer_events.

const DAY_MS = 24 * 60 * 60 * 1000;
const INITIAL_EASINESS = 2.5;
const MIN_EASINESS = 1.3;

export interface ReviewState {
  questionId: string;
  /** SM-2's easiness factor: how quickly the interval grows. */
  easiness: number;
  /** Correct recalls in a row. */
  repetitions: number;
  intervalDays: number;
  dueAt: Date;
  lastReviewedAt: Date;
  /** Times the question was forgotten after having been learned. */
  lapses: number;
}

/** SM-2 quality, 0 to 5. A wrong answer is 1; a right one is 3 to 5 depending on speed. */
export function answerQuality(correct: boolean, timeMs: number): number {
  if (!correct) return 1;
  if (timeMs <= 8_000) return 5;
  if (timeMs <= 20_000) return 4;
  return 3;
}

/** The schedule after one more answer. */
export function nextReview(
  previous: ReviewState | undefined,
  questionId: string,
  quality: number,
  at: Date,
): ReviewState {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError(`Quality must be a whole number from 0 to 5, got ${quality}.`);
  }
  // A correct answer before the question is due proves little: the learner saw
  // it recently. It keeps the schedule as it is, so cramming cannot inflate
  // mastery. A wrong answer still counts at any time: it shows forgetting.
  if (previous && quality >= 3 && at.getTime() < previous.dueAt.getTime()) {
    return { ...previous, lastReviewedAt: at };
  }
  const easiness = previous?.easiness ?? INITIAL_EASINESS;
  const repetitions = previous?.repetitions ?? 0;

  let nextRepetitions: number;
  let intervalDays: number;
  let lapses = previous?.lapses ?? 0;
  if (quality >= 3) {
    nextRepetitions = repetitions + 1;
    intervalDays =
      repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.round(previous!.intervalDays * easiness);
  } else {
    if (repetitions > 0) lapses += 1;
    nextRepetitions = 0;
    intervalDays = 1;
  }
  const miss = 5 - quality;
  const nextEasiness = Math.max(MIN_EASINESS, easiness + (0.1 - miss * (0.08 + miss * 0.02)));

  return {
    questionId,
    easiness: Math.round(nextEasiness * 1000) / 1000,
    repetitions: nextRepetitions,
    intervalDays,
    dueAt: new Date(at.getTime() + intervalDays * DAY_MS),
    lastReviewedAt: at,
    lapses,
  };
}

/** Replays the answer history (in time order) into a schedule per question. */
export function reviewsFromEvents(events: readonly AnswerEvent[]): Map<string, ReviewState> {
  const reviews = new Map<string, ReviewState>();
  const ordered = [...events].sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime());
  for (const event of ordered) {
    reviews.set(
      event.questionId,
      nextReview(
        reviews.get(event.questionId),
        event.questionId,
        answerQuality(event.correct, event.timeMs),
        event.answeredAt,
      ),
    );
  }
  return reviews;
}

/** True when the question is due (or overdue) for review. */
export function isDue(review: ReviewState, now: Date): boolean {
  return review.dueAt.getTime() <= now.getTime();
}

/** The interval (days) at which a question counts as about two-thirds learned. */
export const CONFIDENCE_DAYS = 7;

/**
 * How well a question is known right now, 0 to 1. It grows with the spacing
 * the learner has earned (a question remembered across a long interval is
 * known better than one answered right twice in a day) and fades once the
 * review is overdue, faster for questions with short intervals.
 */
export function questionStrength(review: ReviewState | undefined, now: Date): number {
  if (!review || review.repetitions === 0) return 0;
  const learned = 1 - Math.exp(-review.intervalDays / CONFIDENCE_DAYS);
  const overdueDays = Math.max(0, (now.getTime() - review.dueAt.getTime()) / DAY_MS);
  const retention = Math.exp(-overdueDays / review.intervalDays);
  return learned * retention;
}

export interface TopicMastery {
  topicId: string;
  /** 0 (nothing learned) to 1 (every question in the topic learned and fresh). */
  score: number;
  questions: number;
  answered: number;
  correct: number;
  lastAnsweredAt: Date | null;
}

/**
 * Mastery per topic: the average strength of every question in the topic,
 * counting unseen questions as 0, so a topic is mastered only when all of it is.
 */
export function topicMastery(
  pool: readonly QuizQuestion[],
  events: readonly AnswerEvent[],
  now: Date,
): Map<string, TopicMastery> {
  const reviews = reviewsFromEvents(events);
  const topicOf = new Map(pool.map((question) => [question.id, question.topicId]));
  const result = new Map<string, TopicMastery>();
  const strength = new Map<string, number>();

  for (const question of pool) {
    const entry = result.get(question.topicId) ?? {
      topicId: question.topicId,
      score: 0,
      questions: 0,
      answered: 0,
      correct: 0,
      lastAnsweredAt: null,
    };
    entry.questions += 1;
    result.set(question.topicId, entry);
    strength.set(
      question.topicId,
      (strength.get(question.topicId) ?? 0) + questionStrength(reviews.get(question.id), now),
    );
  }

  for (const event of events) {
    const topicId = topicOf.get(event.questionId);
    if (topicId === undefined) continue;
    const entry = result.get(topicId)!;
    entry.answered += 1;
    if (event.correct) entry.correct += 1;
    if (!entry.lastAnsweredAt || event.answeredAt > entry.lastAnsweredAt) {
      entry.lastAnsweredAt = event.answeredAt;
    }
  }

  for (const entry of result.values()) {
    entry.score = Math.round((strength.get(entry.topicId)! / entry.questions) * 10_000) / 10_000;
  }
  return result;
}
