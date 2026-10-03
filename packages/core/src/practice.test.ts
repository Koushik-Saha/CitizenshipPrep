import { describe, expect, it } from 'vitest';

import {
  adaptiveQuotas,
  buildPracticeSet,
  planAdaptive,
  PracticeError,
  type PracticeOptions,
} from './practice';
import { createRandom } from './random';
import { at, questions } from './test-fixtures';
import type { AnswerEvent } from './types';

const DAY = 24 * 60 * 60 * 1000;
const now = at('2026-10-20T09:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const answer = (questionId: string, when: Date, correct = true): AnswerEvent => ({
  questionId,
  correct,
  timeMs: 4_000,
  answeredAt: when,
});

const government = questions('gov', 10);
const history_ = questions('his', 10, { topicId: 'topic-history', topicSlug: 'history' });
const symbols = questions('sym', 10, { topicId: 'topic-symbols', topicSlug: 'symbols' });
const pool = [...government, ...history_, ...symbols];

const options = (overrides: Partial<PracticeOptions>): PracticeOptions => ({
  mode: 'random',
  size: 5,
  now,
  random: createRandom(1),
  ...overrides,
});

describe('buildPracticeSet', () => {
  it('needs at least one question', () => {
    expect(() => buildPracticeSet(pool, options({ size: 0 }))).toThrow(PracticeError);
    expect(() => buildPracticeSet(pool, options({ size: 1.5 }))).toThrow(
      'A practice set needs at least one question.',
    );
  });

  it('random: the requested number of distinct questions, reproducibly', () => {
    const set = buildPracticeSet(pool, options({ size: 5 }));
    expect(new Set(set.map((q) => q.id)).size).toBe(5);
    expect(buildPracticeSet(pool, options({ size: 5 }))).toEqual(set);
    expect(buildPracticeSet(pool, options({ size: 50 }))).toHaveLength(30);
  });

  it('leaves out excluded questions', () => {
    const excludeIds = new Set(pool.slice(0, 28).map((q) => q.id));
    expect(
      buildPracticeSet(pool, options({ size: 5, excludeIds }))
        .map((q) => q.id)
        .sort(),
    ).toEqual(['sym-8', 'sym-9']);
  });

  it('topic: only the chosen topics, and at least one must be chosen', () => {
    const set = buildPracticeSet(
      pool,
      options({ mode: 'topic', topicIds: ['topic-history'], size: 4 }),
    );
    expect(set).toHaveLength(4);
    expect(set.every((q) => q.topicId === 'topic-history')).toBe(true);
    expect(() => buildPracticeSet(pool, options({ mode: 'topic', topicIds: [] }))).toThrow(
      'Choose at least one topic.',
    );
    expect(() => buildPracticeSet(pool, options({ mode: 'topic' }))).toThrow(PracticeError);
  });
});

describe('adaptiveQuotas', () => {
  it('splits 60 / 25 / 15', () => {
    expect(adaptiveQuotas(20)).toEqual({ weak: 12, due: 5, fresh: 3 });
    expect(adaptiveQuotas(10)).toEqual({ weak: 6, due: 3, fresh: 1 });
    expect(adaptiveQuotas(1)).toEqual({ weak: 1, due: 0, fresh: 0 });
  });
});

describe('adaptive practice', () => {
  // Government: well learned (three correct answers each, not due).
  const learned = government.flatMap((q) => [
    answer(q.id, ago(20)),
    answer(q.id, ago(19)),
    answer(q.id, ago(13)),
  ]);
  // History: answered once, recently (seen, not due, weak topic).
  const weakSeen = history_.map((q) => answer(q.id, ago(0.5)));
  // Symbols: four answered once a while ago, so due; six never seen.
  const due = symbols.slice(0, 4).map((q, i) => answer(q.id, ago(3 + i)));
  const history = [...learned, ...weakSeen, ...due];

  it('sorts the pool into weak, due and new, in priority order', () => {
    const plan = planAdaptive(pool, history, now, createRandom(2));
    expect(plan.due.map((q) => q.id)).toEqual(['sym-3', 'sym-2', 'sym-1', 'sym-0']);
    expect(plan.fresh.map((q) => q.id).sort()).toEqual([
      'sym-4',
      'sym-5',
      'sym-6',
      'sym-7',
      'sym-8',
      'sym-9',
    ]);
    // Weakest topic first: history (barely learned) before government (learned).
    expect(plan.weak.slice(0, 10).every((q) => q.topicId === 'topic-history')).toBe(true);
    expect(plan.weak.slice(10).every((q) => q.topicId === 'topic-government')).toBe(true);
  });

  it('mixes 60% weak topics, 25% due and 15% new', () => {
    const set = buildPracticeSet(
      pool,
      options({ mode: 'adaptive', size: 20, history, random: createRandom(3) }),
    );
    const kind = (id: string) =>
      id.startsWith('his') || id.startsWith('gov')
        ? 'weak'
        : ['sym-0', 'sym-1', 'sym-2', 'sym-3'].includes(id)
          ? 'due'
          : 'new';
    const counts = { weak: 0, due: 0, new: 0 };
    for (const q of set) counts[kind(q.id)] += 1;
    expect(set).toHaveLength(20);
    // 5 due were wanted but only 4 exist; the spare place goes to the weak topics.
    expect(counts).toEqual({ weak: 13, due: 4, new: 3 });
    expect(set.filter((q) => q.id.startsWith('his'))).toHaveLength(10);
  });

  it('fills from whatever is available for a new learner', () => {
    const set = buildPracticeSet(pool, options({ mode: 'adaptive', size: 8 }));
    expect(set).toHaveLength(8);
    expect(new Set(set.map((q) => q.id)).size).toBe(8);
  });

  it('never repeats a question and stops when the pool runs out', () => {
    const set = buildPracticeSet(
      pool.slice(0, 3),
      options({ mode: 'adaptive', size: 10, history }),
    );
    expect(set.map((q) => q.id).sort()).toEqual(['gov-0', 'gov-1', 'gov-2']);
  });
});
