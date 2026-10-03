import { describe, expect, it } from 'vitest';

import { parseBlueprint, type ExamFormat } from './exam-format';
import { CONFIDENCE_DAYS } from './mastery';
import { buildPracticeSet } from './practice';
import { createRandom } from './random';
import {
  MOCK_MAX_WEIGHT,
  mockSignal,
  readinessScore,
  topicShares,
  type MockResult,
} from './readiness';
import { at, questions } from './test-fixtures';
import type { AnswerEvent } from './types';

const DAY = 24 * 60 * 60 * 1000;
const start = at('2026-10-01T09:00:00Z');
const day = (n: number) => new Date(start.getTime() + n * DAY);

const government = questions('gov', 20);
const history = questions('his', 10, { topicId: 'topic-history', topicSlug: 'history' });
const values = questions('val', 10, { topicId: 'topic-values', topicSlug: 'values' });
const pool = [...government, ...history, ...values];

const format = (blueprint: unknown = null): ExamFormat => ({
  id: 'f',
  name: 'Test',
  questionCount: 20,
  passMark: 15,
  timeLimitMinutes: 45,
  blueprint: parseBlueprint(blueprint),
});

const correct = (questionId: string, when: Date): AnswerEvent => ({
  questionId,
  correct: true,
  timeMs: 5_000,
  answeredAt: when,
});

describe('topicShares', () => {
  it('follows the pool when the exam has no topic sections', () => {
    const shares = topicShares(pool, format());
    expect(shares.get('topic-government')).toBeCloseTo(0.5, 10);
    expect(shares.get('topic-history')).toBeCloseTo(0.25, 10);
    expect(shares.get('topic-values')).toBeCloseTo(0.25, 10);
    expect(topicShares(pool, null)).toEqual(shares);
  });

  it('gives a blueprint section’s topics that section’s share of the exam', () => {
    // Australia-style: 5 of 20 questions are values questions.
    const shares = topicShares(
      pool,
      format({
        sections: [
          {
            id: 'values',
            label: 'Values',
            count: 5,
            source: { topics: ['values'] },
            mustAllBeCorrect: true,
          },
          { id: 'rest', label: 'Rest', count: 15, source: { excludeTopics: ['values'] } },
        ],
      }),
    );
    expect(shares.get('topic-values')).toBeCloseTo(0.25, 10);
    expect(shares.get('topic-government')).toBeCloseTo(0.5, 10);
    expect(shares.get('topic-history')).toBeCloseTo(0.25, 10);
  });

  it('splits a section between several of its topics, and ignores topics not in the pool', () => {
    const shares = topicShares(
      pool,
      format({
        sections: [
          {
            id: 'civics',
            label: 'Civics',
            count: 4,
            source: { topics: ['history', 'values', 'missing'] },
          },
          { id: 'ghost', label: 'Ghost', count: 1, source: { topics: ['missing'] } },
          { id: 'rest', label: 'Rest', count: 15 },
        ],
      }),
    );
    expect(shares.get('topic-history')).toBeCloseTo(0.1, 10);
    expect(shares.get('topic-values')).toBeCloseTo(0.1, 10);
    expect(shares.get('topic-government')).toBeCloseTo(0.8, 10);
  });

  it('falls back to the pool for a format without a question count', () => {
    const shares = topicShares(pool, {
      ...format({ sections: [{ id: 'a', label: 'A', count: 20, source: { topics: ['values'] } }] }),
      questionCount: null,
    });
    expect(shares.get('topic-values')).toBeCloseTo(0.25, 10);
  });
});

describe('mockSignal', () => {
  const now = day(30);
  it('is null without recent, valid mock exams', () => {
    expect(mockSignal([], now)).toBeNull();
    expect(mockSignal([{ submittedAt: day(-40), correct: 10, total: 20 }], now)).toBeNull();
    expect(mockSignal([{ submittedAt: day(29), correct: 0, total: 0 }], now)).toBeNull();
  });

  it('treats a mock stamped slightly in the future (clock skew) as fresh', () => {
    expect(
      mockSignal([{ submittedAt: new Date(now.getTime() + 2_000), correct: 10, total: 20 }], now),
    ).toEqual({
      average: 0.5,
      weight: MOCK_MAX_WEIGHT,
    });
  });

  it('weights recent mocks more, and gives one fresh mock the full weight', () => {
    const fresh = mockSignal([{ submittedAt: now, correct: 18, total: 20 }], now)!;
    expect(fresh).toEqual({ average: 0.9, weight: MOCK_MAX_WEIGHT });
    const mixed = mockSignal(
      [
        { submittedAt: now, correct: 20, total: 20 },
        { submittedAt: day(16), correct: 10, total: 20 },
      ],
      now,
    )!;
    // The two-week-old mock counts half as much: (1 * 1 + 0.5 * 0.5) / 1.5.
    expect(mixed.average).toBeCloseTo(1.25 / 1.5, 10);
    const old = mockSignal([{ submittedAt: day(16), correct: 20, total: 20 }], now)!;
    expect(old.weight).toBeCloseTo(MOCK_MAX_WEIGHT / 2, 10);
  });
});

describe('readinessScore', () => {
  it('starts at 0 with a suggestion to begin, flagged as an early estimate', () => {
    const score = readinessScore({ pool, history: [], format: format(), mocks: [], now: start });
    expect(score).toMatchObject({
      score: 0,
      knowledge: 0,
      mockAverage: null,
      isEarlyEstimate: true,
      questionsSeen: 0,
      suggestions: [{ kind: 'start' }],
    });
  });

  // Spaced over three weeks: intervals of 1, 6, 16 and then 43 days, so each
  // question is about as well learned as the model allows.
  const learnSpaced = (qs: typeof pool) =>
    qs.flatMap((q) => [
      correct(q.id, day(0)),
      correct(q.id, day(1)),
      correct(q.id, day(7)),
      correct(q.id, day(23)),
    ]);
  const fullyLearned = 1 - Math.exp(-43 / CONFIDENCE_DAYS);

  it('weights mastery by exam share: a mastered big topic counts more than a mastered small one', () => {
    const governmentOnly = readinessScore({
      pool,
      history: learnSpaced(government),
      format: format(),
      mocks: [],
      now: day(24),
    });
    const historyOnly = readinessScore({
      pool,
      history: learnSpaced(history),
      format: format(),
      mocks: [],
      now: day(24),
    });
    expect(governmentOnly.score).toBe(Math.round(50 * fullyLearned));
    expect(historyOnly.score).toBe(Math.round(25 * fullyLearned));
    expect(historyOnly.topics[0]).toMatchObject({
      topicId: 'topic-government',
      mastery: 0,
      gap: 0.5,
    });
  });

  it('blends in recent mock exams', () => {
    const base = readinessScore({ pool, history: [], format: format(), mocks: [], now: day(10) });
    const mocks: MockResult[] = [{ submittedAt: day(10), correct: 16, total: 20 }];
    const withMock = readinessScore({ pool, history: [], format: format(), mocks, now: day(10) });
    expect(base.score).toBe(0);
    expect(withMock.mockAverage).toBe(0.8);
    expect(withMock.score).toBe(Math.round(0.3 * 0.8 * 100));
  });

  it('suggests reviews, the biggest gaps, then a mock exam once ready for one', () => {
    const learnedAll = learnSpaced(pool);
    const ready = readinessScore({
      pool,
      history: learnedAll,
      format: format(),
      mocks: [],
      now: day(24),
    });
    expect(ready.suggestions).toEqual([{ kind: 'mock' }]);
    expect(ready.isEarlyEstimate).toBe(false);

    const afterMock = readinessScore({
      pool,
      history: learnedAll,
      format: format(),
      mocks: [{ submittedAt: day(23), correct: 18, total: 20 }],
      now: day(24),
    });
    expect(afterMock.suggestions).toEqual([]);

    // Government and history learned, except one history question answered once
    // on day 2 (so long overdue); values never practised.
    const learnedOnly = learnedAll.filter(
      (event) => !event.questionId.startsWith('val') && event.questionId !== 'his-0',
    );
    const partial = readinessScore({
      pool,
      history: [...learnedOnly, correct('his-0', day(2))],
      format: format(),
      mocks: [],
      now: day(24),
    });
    expect(partial.suggestions[0]).toEqual({ kind: 'review', count: 1 });
    expect(partial.suggestions[1]).toMatchObject({
      kind: 'topic',
      topicId: 'topic-values',
      mastery: 0,
    });
    expect(partial.suggestions[2]).toEqual({ kind: 'mock' });
    expect(
      readinessScore({ pool, history: learnedAll, format: null, mocks: [], now: day(24) })
        .suggestions,
    ).toEqual([]);
  });

  it('ignores answers to questions outside the pool when counting what has been seen', () => {
    const score = readinessScore({
      pool,
      history: [correct('elsewhere', day(0))],
      format: format(),
      mocks: [],
      now: day(1),
    });
    expect(score.questionsSeen).toBe(0);
  });

  it('does not reward cramming: answering everything five times in one day stays low', () => {
    const crammed = pool.flatMap((q) =>
      Array.from({ length: 5 }, (_, i) => correct(q.id, new Date(day(0).getTime() + i * 60_000))),
    );
    const score = readinessScore({
      pool,
      history: crammed,
      format: format(),
      mocks: [],
      now: day(0),
    });
    expect(score.score).toBe(Math.round(100 * (1 - Math.exp(-1 / CONFIDENCE_DAYS))));
    expect(score.score).toBeLessThan(20);
  });

  it('rises through a week of correct daily practice, then falls after a month without study', () => {
    let history: AnswerEvent[] = [];
    const daily: number[] = [
      readinessScore({ pool, history, format: format(), mocks: [], now: start }).score,
    ];
    for (let d = 0; d < 7; d += 1) {
      const session = buildPracticeSet(pool, {
        mode: 'adaptive',
        size: 15,
        history,
        now: day(d),
        random: createRandom(d + 1),
      });
      history = [
        ...history,
        ...session.map((q, i) => correct(q.id, new Date(day(d).getTime() + i * 60_000))),
      ];
      daily.push(
        readinessScore({
          pool,
          history,
          format: format(),
          mocks: [],
          now: new Date(day(d).getTime() + 60 * 60_000),
        }).score,
      );
    }
    // Every day of practice adds something...
    for (let d = 1; d < daily.length; d += 1) expect(daily[d]).toBeGreaterThan(daily[d - 1]!);
    // ...but one week of spaced practice gets part of the way, not to the top.
    expect(daily[7]).toBeGreaterThan(25);
    expect(daily[7]).toBeLessThan(70);

    const afterBreak = readinessScore({
      pool,
      history,
      format: format(),
      mocks: [],
      now: day(7 + 30),
    });
    expect(afterBreak.score).toBeLessThan(daily[7]! / 2);
    expect(afterBreak.suggestions[0]).toMatchObject({ kind: 'review' });
  });
});
