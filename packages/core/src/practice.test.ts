import { describe, expect, it } from 'vitest';

import { buildPracticeSet, PracticeError, type PracticeOptions } from './practice';
import { createRandom } from './random';
import { at, question, questions } from './test-fixtures';
import type { AnswerEvent } from './types';

const DAY = 24 * 60 * 60 * 1000;
const now = at('2026-10-20T09:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * DAY);
const correct = (questionId: string, when: Date): AnswerEvent => ({
  questionId,
  correct: true,
  timeMs: 4_000,
  answeredAt: when,
});

const government = questions('gov', 6);
const history = questions('his', 6, { topicId: 'topic-history', topicSlug: 'history' });
const pool = [...government, ...history];

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
    expect(buildPracticeSet(pool, options({ size: 50 }))).toHaveLength(12);
  });

  it('leaves out excluded questions', () => {
    const excludeIds = new Set(pool.slice(0, 10).map((q) => q.id));
    expect(
      buildPracticeSet(pool, options({ size: 5, excludeIds }))
        .map((q) => q.id)
        .sort(),
    ).toEqual(['his-4', 'his-5']);
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

  describe('weak areas', () => {
    // Government is mastered: every question learned three times and not due.
    const learned = government.flatMap((q) => [
      correct(q.id, ago(10)),
      correct(q.id, ago(9)),
      correct(q.id, ago(3)),
    ]);
    // History is weak: one question answered once 3 days ago (due again), one answered once just now.
    const weak = [correct('his-0', ago(3)), correct('his-1', ago(0.5))];

    it('puts due reviews first, then unseen weak-topic questions, then the rest of the weak topic, then strong topics', () => {
      const set = buildPracticeSet(
        pool,
        options({ mode: 'weak', size: 12, history: [...learned, ...weak] }),
      );
      const ids = set.map((q) => q.id);
      expect(ids[0]).toBe('his-0');
      expect(ids.slice(1, 5).sort()).toEqual(['his-2', 'his-3', 'his-4', 'his-5']);
      expect(ids[5]).toBe('his-1');
      expect(ids.slice(6).every((id) => id.startsWith('gov-'))).toBe(true);
    });

    it('orders several due reviews from most overdue', () => {
      const set = buildPracticeSet(
        pool,
        options({
          mode: 'weak',
          size: 2,
          history: [correct('gov-0', ago(5)), correct('gov-1', ago(2))],
        }),
      );
      expect(set.map((q) => q.id)).toEqual(['gov-0', 'gov-1']);
    });

    it('works with no history: weakest topics first, which is everything', () => {
      expect(
        buildPracticeSet([question('only')], options({ mode: 'weak', size: 3 })).map((q) => q.id),
      ).toEqual(['only']);
    });
  });
});
