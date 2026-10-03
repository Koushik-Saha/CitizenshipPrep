import { isDue, questionStrength, reviewsFromEvents, topicMastery } from './mastery';
import { shuffle, type Random } from './random';
import type { AnswerEvent, QuizQuestion } from './types';

export type PracticeMode = 'topic' | 'adaptive' | 'random';

export interface PracticeOptions {
  mode: PracticeMode;
  size: number;
  /** For 'topic' mode: the topics to practise. */
  topicIds?: readonly string[];
  /** The learner's answer history; drives 'adaptive' mode. */
  history?: readonly AnswerEvent[];
  /** Questions to leave out, e.g. the ones in the previous set. */
  excludeIds?: ReadonlySet<string>;
  now: Date;
  random: Random;
}

/** How an adaptive set is split. The shares add up to 1. */
export const ADAPTIVE_MIX = { weak: 0.6, due: 0.25, fresh: 0.15 } as const;

export class PracticeError extends Error {
  override readonly name = 'PracticeError';
}

export interface AdaptivePlan {
  /** Seen, not yet due, from the topics with the lowest mastery. */
  weak: QuizQuestion[];
  /** Due for review under the spaced-repetition schedule, most overdue first. */
  due: QuizQuestion[];
  /** Never answered, from the weakest topics first. */
  fresh: QuizQuestion[];
}

/** How many of each kind a set of `size` gets, before any shortfall is filled. */
export function adaptiveQuotas(size: number): { weak: number; due: number; fresh: number } {
  const weak = Math.round(size * ADAPTIVE_MIX.weak);
  const due = Math.round(size * ADAPTIVE_MIX.due);
  return { weak, due, fresh: Math.max(0, size - weak - due) };
}

/**
 * Sorts the pool into the three kinds of question an adaptive set mixes, each
 * in priority order. Every question lands in at most one list.
 */
export function planAdaptive(
  pool: readonly QuizQuestion[],
  history: readonly AnswerEvent[],
  now: Date,
  random: Random,
): AdaptivePlan {
  const reviews = reviewsFromEvents(history);
  const mastery = topicMastery(pool, history, now);
  const topicScore = (question: QuizQuestion) => mastery.get(question.topicId)!.score;
  // Shuffle first so that equal ranks come out in a random order.
  const shuffled = shuffle(pool, random);

  const due = shuffled
    .filter((question) => {
      const review = reviews.get(question.id);
      return review !== undefined && isDue(review, now);
    })
    .sort((a, b) => reviews.get(a.id)!.dueAt.getTime() - reviews.get(b.id)!.dueAt.getTime());

  const fresh = shuffled
    .filter((question) => !reviews.has(question.id))
    .sort((a, b) => topicScore(a) - topicScore(b));

  const weak = shuffled
    .filter((question) => {
      const review = reviews.get(question.id);
      return review !== undefined && !isDue(review, now);
    })
    .map((question) => ({ question, strength: questionStrength(reviews.get(question.id), now) }))
    .sort((a, b) => topicScore(a.question) - topicScore(b.question) || a.strength - b.strength)
    .map((entry) => entry.question);

  return { weak, due, fresh };
}

/**
 * An adaptive set: 60% from weak topics, 25% due for review, 15% new. When a
 * kind runs short, the others fill its places, so the set is as full as the
 * pool allows. The result is shuffled so the kinds are interleaved.
 */
function adaptiveSet(pool: readonly QuizQuestion[], options: PracticeOptions): QuizQuestion[] {
  const plan = planAdaptive(pool, options.history ?? [], options.now, options.random);
  const quotas = adaptiveQuotas(options.size);
  const chosen = [
    ...plan.weak.slice(0, quotas.weak),
    ...plan.due.slice(0, quotas.due),
    ...plan.fresh.slice(0, quotas.fresh),
  ];
  // Fill any shortfall: weak topics first, then reviews, then new questions.
  const leftovers = [
    ...plan.weak.slice(quotas.weak),
    ...plan.due.slice(quotas.due),
    ...plan.fresh.slice(quotas.fresh),
  ];
  chosen.push(...leftovers.slice(0, options.size - chosen.length));
  return shuffle(chosen, options.random);
}

/** A practice set: adaptive, by topic, or at random. */
export function buildPracticeSet(
  pool: readonly QuizQuestion[],
  options: PracticeOptions,
): QuizQuestion[] {
  if (!Number.isInteger(options.size) || options.size < 1) {
    throw new PracticeError('A practice set needs at least one question.');
  }
  const available = pool.filter((question) => !options.excludeIds?.has(question.id));

  switch (options.mode) {
    case 'topic': {
      const topics = new Set(options.topicIds ?? []);
      if (topics.size === 0) throw new PracticeError('Choose at least one topic.');
      return shuffle(
        available.filter((question) => topics.has(question.topicId)),
        options.random,
      ).slice(0, options.size);
    }
    case 'adaptive':
      return adaptiveSet(available, options);
    case 'random':
      return shuffle(available, options.random).slice(0, options.size);
  }
}
