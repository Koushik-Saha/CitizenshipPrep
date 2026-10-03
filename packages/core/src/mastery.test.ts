import { describe, expect, it } from 'vitest';

import {
  answerQuality,
  isDue,
  nextReview,
  questionStrength,
  reviewsFromEvents,
  topicMastery,
  type ReviewState,
} from './mastery';
import { at, question } from './test-fixtures';
import type { AnswerEvent } from './types';

const DAY = 24 * 60 * 60 * 1000;
const start = at('2026-10-01T09:00:00Z');
const days = (n: number) => new Date(start.getTime() + n * DAY);
const event = (questionId: string, correct: boolean, when: Date, timeMs = 5_000): AnswerEvent => ({
  questionId,
  correct,
  timeMs,
  answeredAt: when,
});

describe('answerQuality', () => {
  it('rates a wrong answer 1 and a right one 5, 4 or 3 by speed', () => {
    expect(answerQuality(false, 1_000)).toBe(1);
    expect(answerQuality(true, 8_000)).toBe(5);
    expect(answerQuality(true, 20_000)).toBe(4);
    expect(answerQuality(true, 20_001)).toBe(3);
  });
});

describe('nextReview (SM-2)', () => {
  it('schedules 1 day, then 6 days, then the interval times the easiness', () => {
    const first = nextReview(undefined, 'q', 4, start);
    expect(first).toEqual({
      questionId: 'q',
      easiness: 2.5,
      repetitions: 1,
      intervalDays: 1,
      dueAt: days(1),
      lastReviewedAt: start,
      lapses: 0,
    });
    const second = nextReview(first, 'q', 5, days(1));
    expect(second).toMatchObject({ repetitions: 2, intervalDays: 6, easiness: 2.6 });
    const third = nextReview(second, 'q', 4, days(7));
    expect(third).toMatchObject({
      repetitions: 3,
      intervalDays: Math.round(6 * 2.6),
      dueAt: days(7 + 16),
    });
  });

  it('starts over after a wrong answer, counting a lapse only if the question had been learned', () => {
    const fresh = nextReview(undefined, 'q', 1, start);
    expect(fresh).toMatchObject({ repetitions: 0, intervalDays: 1, lapses: 0, easiness: 1.96 });
    const learned = nextReview(nextReview(undefined, 'q', 5, start), 'q', 5, days(1));
    expect(nextReview(learned, 'q', 2, days(7))).toMatchObject({
      repetitions: 0,
      intervalDays: 1,
      lapses: 1,
    });
  });

  it('never lets easiness fall below 1.3', () => {
    let state: ReviewState | undefined;
    for (let i = 0; i < 10; i += 1) state = nextReview(state, 'q', 0, days(i));
    expect(state!.easiness).toBe(1.3);
  });

  it('rejects a quality outside 0 to 5', () => {
    expect(() => nextReview(undefined, 'q', 6, start)).toThrow(RangeError);
    expect(() => nextReview(undefined, 'q', -1, start)).toThrow(RangeError);
    expect(() => nextReview(undefined, 'q', 2.5, start)).toThrow(
      'Quality must be a whole number from 0 to 5, got 2.5.',
    );
  });
});

describe('reviewsFromEvents', () => {
  it('replays answers in time order, whatever order they arrive in', () => {
    const reviews = reviewsFromEvents([
      event('q1', true, days(1)),
      event('q1', true, days(0)),
      event('q2', false, days(0)),
    ]);
    expect(reviews.get('q1')).toMatchObject({
      repetitions: 2,
      intervalDays: 6,
      lastReviewedAt: days(1),
    });
    expect(reviews.get('q2')).toMatchObject({ repetitions: 0 });
  });
});

describe('isDue and questionStrength', () => {
  const learned = reviewsFromEvents([
    event('q', true, days(0)),
    event('q', true, days(1)),
    event('q', true, days(7)),
  ]).get('q')!;

  it('knows when a review is due', () => {
    expect(isDue(learned, days(8))).toBe(false);
    expect(isDue(learned, learned.dueAt)).toBe(true);
  });

  it('is 0 for unseen or forgotten questions, 1 for learned and fresh, and fades when overdue', () => {
    expect(questionStrength(undefined, start)).toBe(0);
    expect(questionStrength(nextReview(undefined, 'q', 1, start), start)).toBe(0);
    expect(questionStrength(nextReview(undefined, 'q', 5, start), start)).toBeCloseTo(1 / 3, 10);
    expect(questionStrength(learned, days(8))).toBe(1);
    const overdue = questionStrength(
      learned,
      new Date(learned.dueAt.getTime() + learned.intervalDays * DAY),
    );
    expect(overdue).toBeCloseTo(Math.exp(-1), 10);
  });
});

describe('topicMastery', () => {
  const pool = [question('g1'), question('g2'), question('h1', { topicId: 'topic-history' })];

  it('averages question strength over the whole topic, counting unseen questions as 0', () => {
    const events = [
      event('g1', true, days(0)),
      event('g1', true, days(1)),
      event('g1', true, days(7)),
      event('h1', false, days(2)),
    ];
    const mastery = topicMastery(pool, events, days(8));
    expect(mastery.get('topic-government')).toEqual({
      topicId: 'topic-government',
      score: 0.5,
      questions: 2,
      answered: 3,
      correct: 3,
      lastAnsweredAt: days(7),
    });
    expect(mastery.get('topic-history')).toEqual({
      topicId: 'topic-history',
      score: 0,
      questions: 1,
      answered: 1,
      correct: 0,
      lastAnsweredAt: days(2),
    });
  });

  it('keeps the latest answer time whatever the order, and ignores questions outside the pool', () => {
    const mastery = topicMastery(
      pool,
      [event('g2', true, days(5)), event('g1', true, days(3)), event('gone', true, days(9))],
      days(6),
    );
    expect(mastery.get('topic-government')!.lastAnsweredAt).toEqual(days(5));
    expect(mastery.get('topic-government')!.answered).toBe(2);
  });
});
