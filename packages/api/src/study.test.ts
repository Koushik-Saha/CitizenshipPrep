import { describe, expect, it } from 'vitest';

import {
  isSpokenFormat,
  resumeSession,
  toMockExam,
  toQuizQuestion,
  type StudySession,
} from './study';

const question = {
  id: 'q1',
  version: 3,
  topicId: 't1',
  topicName: 'History',
  type: 'multiple_choice' as const,
  correctKeys: ['b'],
};

describe('isSpokenFormat', () => {
  it('is true for exams asked and answered aloud', () => {
    expect(isSpokenFormat('oral')).toBe(true);
    expect(isSpokenFormat('interview')).toBe(true);
    expect(isSpokenFormat('written')).toBe(false);
    expect(isSpokenFormat('language')).toBe(false);
  });
});

describe('toQuizQuestion', () => {
  it('gives the engine what it scores with', () => {
    expect(toQuizQuestion(question as never)).toEqual({
      id: 'q1',
      topicId: 't1',
      topicSlug: 't1',
      difficulty: 1,
      type: 'multiple_choice',
      correctKeys: ['b'],
      regionCode: null,
      version: 3,
    });
  });
});

describe('toMockExam', () => {
  const session = {
    attemptId: 'attempt-1',
    questions: [question, { ...question, id: 'q2' }],
    exam: null,
  } as unknown as StudySession;

  it('is null for practice and flashcards', () => {
    expect(toMockExam(session)).toBeNull();
  });

  it('carries the exam’s rules for a mock exam', () => {
    const exam = {
      sections: [],
      questionCount: 2,
      passMark: 1,
      timeLimitMs: 60_000,
      stopEarly: true,
    };
    expect(toMockExam({ ...session, exam } as unknown as StudySession)).toEqual({
      formatId: 'attempt-1',
      questionIds: ['q1', 'q2'],
      sections: [],
      questionCount: 2,
      passMark: 1,
      timeLimitMs: 60_000,
      stopEarly: true,
    });
  });
});

describe('resumeSession', () => {
  const answer = (questionId: string, answeredAt: string, correct = true) => ({
    questionId,
    selectedKeys: ['a'],
    correct,
    timeMs: 1000,
    answeredAt,
  });

  it('carries on at the first question not yet answered, with the answers so far', () => {
    const resumed = resumeSession(
      ['q1', 'q2', 'q3', 'q4'],
      [answer('q2', '2026-10-14T10:01:00Z'), answer('q1', '2026-10-14T10:00:00Z')],
    );
    expect(resumed.index).toBe(2);
    expect(resumed.answers.map((given) => given.questionId)).toEqual(['q1', 'q2']);
  });

  it('counts the first answer to a question once, wherever it came from', () => {
    // Saved on the server, and still in the device's queue: the same answer twice.
    const first = answer('q1', '2026-10-14T10:00:00Z', false);
    const resumed = resumeSession(
      ['q1', 'q2'],
      [answer('q1', '2026-10-14T10:05:00Z', true), first, { ...first }],
    );
    expect(resumed.answers).toEqual([first]);
    expect(resumed.index).toBe(1);
  });

  it('is at the end once every question is answered, and ignores answers from elsewhere', () => {
    expect(
      resumeSession(
        ['q1'],
        [answer('q1', '2026-10-14T10:00:00Z'), answer('x', '2026-10-14T10:00:00Z')],
      ),
    ).toEqual({ answers: [answer('q1', '2026-10-14T10:00:00Z')], index: 1 });
    expect(resumeSession(['q1', 'q2'], [])).toEqual({ answers: [], index: 0 });
  });
});
