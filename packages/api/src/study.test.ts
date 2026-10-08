import { describe, expect, it } from 'vitest';

import { isSpokenFormat, toMockExam, toQuizQuestion, type StudySession } from './study';

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
