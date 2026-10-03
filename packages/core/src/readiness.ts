import type { ExamFormat } from './exam-format';
import { isDue, reviewsFromEvents, topicMastery } from './mastery';
import type { AnswerEvent, QuizQuestion } from './types';

// The readiness score: an estimate, 0 to 100, of how prepared a learner is
// for one country's exam. It is
//
//   knowledge: mastery per topic, weighted by that topic's share of the real
//              exam. Mastery already fades as reviews go overdue, so it falls
//              when the learner stops practising.
//   mock exams: recent results, each counting less as it ages (14-day
//              half-life), together worth up to 30% of the score.

const DAY_MS = 24 * 60 * 60 * 1000;
export const MOCK_HALF_LIFE_DAYS = 14;
export const MOCK_MAX_WEIGHT = 0.3;
const MOCK_WINDOW_DAYS = 60;

export interface MockResult {
  submittedAt: Date;
  correct: number;
  total: number;
}

export interface TopicReadiness {
  topicId: string;
  /** This topic's share of the real exam, 0 to 1. */
  share: number;
  /** 0 to 1. */
  mastery: number;
  /** What the topic is costing the score: share times what is not yet mastered. */
  gap: number;
}

export type StudySuggestion =
  | { kind: 'start' }
  | { kind: 'review'; count: number }
  | { kind: 'topic'; topicId: string; share: number; mastery: number }
  | { kind: 'mock' };

export interface ReadinessScore {
  /** 0 to 100. */
  score: number;
  /** Topic mastery weighted by exam share, 0 to 1. */
  knowledge: number;
  /** Recency-weighted share of mock exam answers right, 0 to 1; null without recent mocks. */
  mockAverage: number | null;
  /** True until enough of the pool has been practised for the score to mean much. */
  isEarlyEstimate: boolean;
  /** Distinct questions answered at least once. */
  questionsSeen: number;
  topics: TopicReadiness[];
  /** At most three, most useful first. */
  suggestions: StudySuggestion[];
}

/**
 * Each topic's share of the real exam. Sections of the exam's blueprint that
 * name topics fix those topics' shares; the rest of the exam is split by how
 * much of the question pool each remaining topic holds, which mirrors how the
 * official pools are drawn.
 */
export function topicShares(
  pool: readonly QuizQuestion[],
  format: ExamFormat | null,
): Map<string, number> {
  const slugOf = new Map(pool.map((question) => [question.topicId, question.topicSlug]));
  const poolCount = new Map<string, number>();
  for (const question of pool)
    poolCount.set(question.topicId, (poolCount.get(question.topicId) ?? 0) + 1);

  const shares = new Map<string, number>();
  let fixedShare = 0;
  const total = format?.questionCount ?? 0;
  for (const section of format?.blueprint.sections ?? []) {
    const topics = section.source.topics;
    if (!topics || total === 0) continue;
    const inPool = [...poolCount.keys()].filter((topicId) => topics.includes(slugOf.get(topicId)!));
    if (inPool.length === 0) continue;
    const sectionShare = section.count / total;
    const sectionPool = inPool.reduce((sum, topicId) => sum + poolCount.get(topicId)!, 0);
    for (const topicId of inPool)
      shares.set(topicId, (sectionShare * poolCount.get(topicId)!) / sectionPool);
    fixedShare += sectionShare;
  }

  const rest = [...poolCount.keys()].filter((topicId) => !shares.has(topicId));
  const restPool = rest.reduce((sum, topicId) => sum + poolCount.get(topicId)!, 0);
  for (const topicId of rest)
    shares.set(topicId, ((1 - fixedShare) * poolCount.get(topicId)!) / restPool);
  return shares;
}

/** Recency-weighted mock exam average, and how much weight the mocks earn (0 to MOCK_MAX_WEIGHT). */
export function mockSignal(
  mocks: readonly MockResult[],
  now: Date,
): { average: number; weight: number } | null {
  let weighted = 0;
  let weights = 0;
  for (const mock of mocks) {
    // Clocks differ a little between servers: a mock stamped just ahead of `now` is fresh, not ignored.
    const ageDays = Math.max(0, (now.getTime() - mock.submittedAt.getTime()) / DAY_MS);
    if (mock.total <= 0 || ageDays > MOCK_WINDOW_DAYS) continue;
    const weight = 0.5 ** (ageDays / MOCK_HALF_LIFE_DAYS);
    weighted += weight * (mock.correct / mock.total);
    weights += weight;
  }
  if (weights === 0) return null;
  // One fresh mock earns the full weight; older ones earn less.
  return { average: weighted / weights, weight: MOCK_MAX_WEIGHT * Math.min(1, weights) };
}

export interface ReadinessInput {
  /** The published questions for the country. */
  pool: readonly QuizQuestion[];
  history: readonly AnswerEvent[];
  /** The exam being prepared for; its blueprint shapes the topic shares. */
  format: ExamFormat | null;
  mocks: readonly MockResult[];
  now: Date;
}

export function readinessScore(input: ReadinessInput): ReadinessScore {
  const { pool, history, now } = input;
  const mastery = topicMastery(pool, history, now);
  const shares = topicShares(pool, input.format);
  const poolIds = new Set(pool.map((question) => question.id));
  const reviews = reviewsFromEvents(history.filter((event) => poolIds.has(event.questionId)));

  const topics: TopicReadiness[] = [...shares.entries()]
    .map(([topicId, share]) => {
      const score = mastery.get(topicId)!.score;
      return { topicId, share, mastery: score, gap: share * (1 - score) };
    })
    .sort((a, b) => b.gap - a.gap);
  const knowledge = topics.reduce((sum, topic) => sum + topic.share * topic.mastery, 0);

  const mock = mockSignal(input.mocks, now);
  const blended = mock ? (1 - mock.weight) * knowledge + mock.weight * mock.average : knowledge;

  const questionsSeen = reviews.size;
  const isEarlyEstimate = questionsSeen < Math.min(30, Math.ceil(pool.length / 3));

  const suggestions: StudySuggestion[] = [];
  if (questionsSeen === 0) {
    suggestions.push({ kind: 'start' });
  } else {
    const dueCount = [...reviews.values()].filter((review) => isDue(review, now)).length;
    if (dueCount > 0) suggestions.push({ kind: 'review', count: dueCount });
    for (const topic of topics.filter((candidate) => candidate.gap >= 0.05).slice(0, 2)) {
      suggestions.push({
        kind: 'topic',
        topicId: topic.topicId,
        share: topic.share,
        mastery: topic.mastery,
      });
    }
    const recentMock = input.mocks.some(
      (result) => now.getTime() - result.submittedAt.getTime() < 7 * DAY_MS,
    );
    if (input.format && knowledge >= 0.6 && !recentMock) suggestions.push({ kind: 'mock' });
  }

  return {
    score: Math.round(Math.min(1, Math.max(0, blended)) * 100),
    knowledge,
    mockAverage: mock?.average ?? null,
    isEarlyEstimate,
    questionsSeen,
    topics,
    suggestions: suggestions.slice(0, 3),
  };
}
