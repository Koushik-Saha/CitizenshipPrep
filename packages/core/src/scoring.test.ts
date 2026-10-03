import { describe, expect, it } from 'vitest';

import type { MockExam } from './mock-exam';
import { examDecision, isCorrect, scoreAttempt } from './scoring';
import { at, question, questions } from './test-fixtures';
import type { Answer } from './types';

const answer = (
  questionId: string,
  selectedKeys: string[],
  time = '2026-10-03T10:00:00Z',
): Answer => ({
  questionId,
  selectedKeys,
  timeMs: 5_000,
  answeredAt: at(time),
});

describe('isCorrect', () => {
  it('needs exactly the right option for single-answer questions', () => {
    expect(isCorrect(question('q'), ['a'])).toBe(true);
    expect(isCorrect(question('q'), ['b'])).toBe(false);
    expect(isCorrect(question('q'), [])).toBe(false);
    expect(isCorrect(question('q', { type: 'true_false', correctKeys: ['true'] }), ['true'])).toBe(
      true,
    );
  });

  it('needs every right option and nothing else for multi-select', () => {
    const multi = question('m', { type: 'multi_select', correctKeys: ['a', 'c'] });
    expect(isCorrect(multi, ['c', 'a'])).toBe(true);
    expect(isCorrect(multi, ['a'])).toBe(false);
    expect(isCorrect(multi, ['a', 'b', 'c'])).toBe(false);
    expect(isCorrect(multi, ['a', 'b'])).toBe(false);
  });

  it('accepts any accepted answer for free response', () => {
    const free = question('f', { type: 'free_response', correctKeys: ['a', 'b', 'c'] });
    expect(isCorrect(free, ['b'])).toBe(true);
    expect(isCorrect(free, ['z'])).toBe(false);
  });
});

describe('scoreAttempt', () => {
  const set = [
    question('q1'),
    question('q2'),
    question('q3', { topicId: 'topic-history' }),
    question('q4', { topicId: 'topic-history' }),
  ];

  it('counts right, wrong and unanswered, overall and per topic', () => {
    const score = scoreAttempt(set, [
      answer('q1', ['a']),
      answer('q2', ['b']),
      answer('q3', ['a']),
    ]);
    expect(score).toEqual({
      total: 4,
      answered: 3,
      correct: 2,
      incorrect: 1,
      unanswered: 1,
      percent: 50,
      byTopic: {
        'topic-government': { total: 2, answered: 2, correct: 1 },
        'topic-history': { total: 2, answered: 1, correct: 1 },
      },
    });
  });

  it('counts the last answer given to a question', () => {
    const score = scoreAttempt(
      [question('q1')],
      [answer('q1', ['a'], '2026-10-03T10:00:05Z'), answer('q1', ['b'], '2026-10-03T10:00:01Z')],
    );
    expect(score.correct).toBe(1);
  });

  it('ignores answers to questions that are not in the set, and handles an empty set', () => {
    expect(scoreAttempt([question('q1')], [answer('other', ['a'])]).answered).toBe(0);
    expect(scoreAttempt([], []).percent).toBe(0);
  });

  describe('as a mock exam', () => {
    const pool = questions('q', 5);
    const exam: MockExam = {
      formatId: 'f',
      questionIds: pool.map((q) => q.id),
      sections: [
        { id: 'values', label: 'Values', questionIds: ['q-0', 'q-1'], mustAllBeCorrect: true },
        {
          id: 'general',
          label: 'General',
          questionIds: ['q-2', 'q-3', 'q-4'],
          mustAllBeCorrect: false,
        },
      ],
      questionCount: 5,
      passMark: 4,
      timeLimitMs: 60_000,
      stopEarly: false,
    };
    const startedAt = at('2026-10-03T10:00:00Z');
    const allRight = pool.map((q) => answer(q.id, ['a'], '2026-10-03T10:00:30Z'));

    it('passes when the pass mark and every all-correct section are met', () => {
      expect(scoreAttempt(pool, allRight, { exam, startedAt }).exam).toEqual({
        passed: true,
        reasons: [],
        timedOut: false,
        sections: [
          { id: 'values', label: 'Values', total: 2, correct: 2, passed: true },
          { id: 'general', label: 'General', total: 3, correct: 3, passed: true },
        ],
      });
    });

    it('fails below the pass mark, and says why', () => {
      const answers = allRight.map((a, i) => (i >= 3 ? { ...a, selectedKeys: ['b'] } : a));
      expect(scoreAttempt(pool, answers, { exam, startedAt }).exam).toMatchObject({
        passed: false,
        reasons: ['3 of 5 correct; 4 are needed to pass.'],
      });
    });

    it('fails when an all-correct section has a wrong answer, even above the pass mark', () => {
      const answers = allRight.map((a, i) => (i === 0 ? { ...a, selectedKeys: ['b'] } : a));
      expect(scoreAttempt(pool, answers, { exam, startedAt }).exam).toMatchObject({
        passed: false,
        reasons: ['Every "Values" question must be correct; 1 of 2 were.'],
      });
    });

    it('ignores answers after the time limit and reports the time-out', () => {
      const late = [
        ...allRight.slice(0, 3),
        ...allRight.slice(3).map((a) => ({ ...a, answeredAt: at('2026-10-03T10:01:01Z') })),
      ];
      const score = scoreAttempt(pool, late, { exam, startedAt });
      expect(score.correct).toBe(3);
      expect(score.exam).toMatchObject({ passed: false, timedOut: true });
    });

    it('needs the start time for a timed exam', () => {
      expect(() => scoreAttempt(pool, allRight, { exam })).toThrow(
        'A timed exam needs the time it started.',
      );
    });

    it('scores an untimed exam with no pass mark on its sections alone', () => {
      const untimed = { ...exam, timeLimitMs: null, passMark: null };
      expect(scoreAttempt(pool, [], { exam: untimed }).exam).toMatchObject({
        passed: false,
        timedOut: false,
        reasons: ['Every "Values" question must be correct; 0 of 2 were.'],
      });
    });
  });
});

describe('examDecision', () => {
  // The U.S. civics test: 20 questions, 12 to pass; the officer stops at 12 right or 9 wrong.
  const pool = questions('q', 20);
  const exam: MockExam = {
    formatId: 'us',
    questionIds: pool.map((q) => q.id),
    sections: [
      { id: 'all', label: 'Civics', questionIds: pool.map((q) => q.id), mustAllBeCorrect: false },
    ],
    questionCount: 20,
    passMark: 12,
    timeLimitMs: null,
    stopEarly: true,
  };
  const answers = (right: number, wrong: number) => [
    ...pool.slice(0, right).map((q) => answer(q.id, ['a'])),
    ...pool.slice(right, right + wrong).map((q) => answer(q.id, ['b'])),
  ];

  it('stops with a pass at the 12th correct answer', () => {
    expect(examDecision(exam, pool, answers(11, 3))).toBeNull();
    expect(examDecision(exam, pool, answers(12, 3))).toBe('passed');
  });

  it('stops with a fail at the 9th wrong answer', () => {
    expect(examDecision(exam, pool, answers(5, 8))).toBeNull();
    expect(examDecision(exam, pool, answers(5, 9))).toBe('failed');
  });

  it('fails at once on a wrong answer in an all-correct section, and waits for that section otherwise', () => {
    const strict: MockExam = {
      ...exam,
      sections: [
        { id: 'values', label: 'Values', questionIds: ['q-19'], mustAllBeCorrect: true },
        {
          id: 'rest',
          label: 'Rest',
          questionIds: pool.slice(0, 19).map((q) => q.id),
          mustAllBeCorrect: false,
        },
      ],
    };
    expect(examDecision(strict, pool, answers(12, 0))).toBeNull();
    expect(examDecision(strict, pool, [...answers(12, 0), answer('q-19', ['a'])])).toBe('passed');
    expect(examDecision(strict, pool, [answer('q-19', ['b'])])).toBe('failed');
  });

  it('cannot decide without a pass mark, and ignores answers to unknown questions', () => {
    expect(examDecision({ ...exam, passMark: null }, pool, answers(20, 0))).toBeNull();
    expect(examDecision(exam, pool, [answer('unknown', ['b'])])).toBeNull();
  });
});
