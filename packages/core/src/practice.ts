import { isDue, reviewsFromEvents, topicMastery } from './mastery';
import { shuffle, type Random } from './random';
import type { AnswerEvent, QuizQuestion } from './types';

export type PracticeMode = 'topic' | 'weak' | 'random';

export interface PracticeOptions {
  mode: PracticeMode;
  size: number;
  /** For 'topic' mode: the topics to practise. */
  topicIds?: readonly string[];
  /** The learner's answer history; drives 'weak' mode. */
  history?: readonly AnswerEvent[];
  /** Questions to leave out, e.g. the ones in the previous set. */
  excludeIds?: ReadonlySet<string>;
  now: Date;
  random: Random;
}

/** Below this mastery a topic counts as weak. */
export const WEAK_TOPIC_THRESHOLD = 0.6;

export class PracticeError extends Error {
  override readonly name = 'PracticeError';
}

/**
 * Weak-areas order: questions due for review first (most overdue first), then
 * unseen questions from weak topics (weakest first), then the rest of the weak
 * topics, then everything else. Ties are broken at random.
 */
function weakAreasOrder(pool: readonly QuizQuestion[], options: PracticeOptions): QuizQuestion[] {
  const history = options.history ?? [];
  const reviews = reviewsFromEvents(history);
  const mastery = topicMastery(pool, history, options.now);

  const rank = (question: QuizQuestion): [number, number] => {
    const review = reviews.get(question.id);
    const topicScore = mastery.get(question.topicId)!.score;
    if (review && isDue(review, options.now)) {
      return [0, review.dueAt.getTime() - options.now.getTime()];
    }
    if (topicScore < WEAK_TOPIC_THRESHOLD) return [review ? 2 : 1, topicScore];
    return [3, topicScore];
  };

  return shuffle(pool, options.random)
    .map((question) => ({ question, rank: rank(question) }))
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1])
    .map((entry) => entry.question);
}

/** A practice set: by topic, focused on weak areas, or at random. */
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
    case 'weak':
      return weakAreasOrder(available, options).slice(0, options.size);
    case 'random':
      return shuffle(available, options.random).slice(0, options.size);
  }
}
