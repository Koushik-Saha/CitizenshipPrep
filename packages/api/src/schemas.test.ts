import { describe, expect, it } from 'vitest';

import {
  answersRequestSchema,
  countryCodeSchema,
  dashboardSchema,
  examResultRequestSchema,
  explainRequestSchema,
  idSchema,
  offlineAttemptsSchema,
  queuedAnswerSchema,
  sessionResultSchema,
  startSessionRequestSchema,
  timeZoneRequestSchema,
  tutorRequestSchema,
} from './schemas';

// What clients send. Each schema is the only thing between a request body
// and the code that acts on it.

const id = '10000000-0000-4000-8000-000000000001';
const ok = (schema: { safeParse(value: unknown): { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('idSchema and countryCodeSchema', () => {
  it('accept anything shaped like a UUID, whatever its version', () => {
    expect(ok(idSchema, id)).toBe(true);
    // Postgres hands these out too, and fixtures use them.
    expect(ok(idSchema, '70000000-0000-0000-0000-000000000001')).toBe(true);
    expect(ok(idSchema, id.toUpperCase())).toBe(true);
  });

  it('refuse everything else, so nothing else reaches a query as an id', () => {
    for (const value of ['', 'abc', `${id}x`, "1' or '1'='1", 42, null, undefined, {}]) {
      expect(ok(idSchema, value), String(value)).toBe(false);
    }
  });

  it('take a country as two letters, either case', () => {
    expect(ok(countryCodeSchema, 'US')).toBe(true);
    expect(ok(countryCodeSchema, 'zz')).toBe(true);
    for (const value of ['USA', 'U', '', 'U1', 'United States', 12, null]) {
      expect(ok(countryCodeSchema, value), String(value)).toBe(false);
    }
  });
});

describe('startSessionRequestSchema', () => {
  it('accepts a practice session, flashcards and a mock exam', () => {
    for (const request of [
      { kind: 'practice', countryCode: 'ZZ', focus: 'adaptive', size: 10 },
      { kind: 'practice', countryCode: 'ZZ', focus: { topicId: id }, size: 1 },
      { kind: 'flashcards', countryCode: 'zz', focus: 'random', size: 100 },
      { kind: 'mock_exam', countryCode: 'ZZ', examFormatId: id },
    ]) {
      expect(ok(startSessionRequestSchema, request), JSON.stringify(request)).toBe(true);
    }
  });

  it('refuses a size out of range, an unknown kind, and ids that are not ids', () => {
    for (const request of [
      { kind: 'practice', countryCode: 'ZZ', focus: 'adaptive', size: 0 },
      { kind: 'practice', countryCode: 'ZZ', focus: 'adaptive', size: 101 },
      { kind: 'practice', countryCode: 'ZZ', focus: 'adaptive', size: 2.5 },
      { kind: 'practice', countryCode: 'ZZ', focus: 'everything', size: 10 },
      { kind: 'practice', countryCode: 'ZZ', focus: { topicId: 'history' }, size: 10 },
      { kind: 'practice', countryCode: 'Testland', focus: 'random', size: 10 },
      { kind: 'mock_exam', countryCode: 'ZZ', examFormatId: 'civics' },
      { kind: 'essay', countryCode: 'ZZ' },
      null,
      [],
    ]) {
      expect(ok(startSessionRequestSchema, request), JSON.stringify(request)).toBe(false);
    }
  });
});

describe('queuedAnswerSchema', () => {
  const answer = {
    clientEventId: id,
    attemptId: id,
    questionId: id,
    questionVersion: 1,
    selectedKeys: ['a'],
    correct: true,
    timeMs: 0,
    answeredAt: '2026-10-08T10:00:00.000Z',
  };
  const reason = (value: unknown) => {
    const parsed = queuedAnswerSchema.safeParse(value);
    return parsed.success ? null : parsed.error.issues[0]!.message;
  };

  it('accepts a well-formed answer, including one with nothing selected', () => {
    expect(reason(answer)).toBeNull();
    expect(reason({ ...answer, selectedKeys: [] })).toBeNull();
  });

  it('says what is wrong, in words the client can show', () => {
    expect(reason({ ...answer, clientEventId: 'e1' })).toBe('clientEventId must be a UUID.');
    expect(reason({ ...answer, attemptId: 'a1' })).toBe('Unknown attempt or question.');
    expect(reason({ ...answer, questionId: 7 })).toBe('Unknown attempt or question.');
    expect(reason({ ...answer, questionVersion: 0 })).toBe('Invalid question version.');
    expect(reason({ ...answer, questionVersion: '1' })).toBe('Invalid question version.');
    expect(reason({ ...answer, timeMs: -1 })).toBe('Invalid answer time.');
    expect(reason({ ...answer, timeMs: 1.5 })).toBe('Invalid answer time.');
    expect(reason({ ...answer, answeredAt: 'yesterday' })).toBe('Invalid answer timestamp.');
    expect(reason({ ...answer, answeredAt: 1 })).toBe('Invalid answer timestamp.');
    expect(reason({ ...answer, correct: 'yes' })).toBe('Invalid answer.');
    expect(reason({ ...answer, selectedKeys: 'a' })).toBe('Invalid answer.');
    expect(reason({ ...answer, selectedKeys: Array.from({ length: 21 }, () => 'a') })).toBe(
      'Invalid answer.',
    );
  });
});

describe('the other request bodies', () => {
  it('take a batch of at most 100 answers, checked one by one later', () => {
    expect(ok(answersRequestSchema, { answers: [] })).toBe(true);
    expect(ok(answersRequestSchema, { answers: [null, 'x', {}] })).toBe(true);
    expect(ok(answersRequestSchema, { answers: Array.from({ length: 101 }, () => ({})) })).toBe(
      false,
    );
    expect(ok(answersRequestSchema, { answers: 'x' })).toBe(false);
    expect(ok(answersRequestSchema, null)).toBe(false);
  });

  it('take a question to explain by its id', () => {
    expect(ok(explainRequestSchema, { questionId: id })).toBe(true);
    expect(ok(explainRequestSchema, { questionId: 'the first one' })).toBe(false);
    expect(ok(explainRequestSchema, {})).toBe(false);
  });

  it('take a tutor conversation of bounded length for a country', () => {
    expect(ok(tutorRequestSchema, { countryCode: 'ZZ', messages: [] })).toBe(true);
    expect(
      ok(tutorRequestSchema, { countryCode: 'ZZ', messages: [{ role: 'user', content: 'Hi' }] }),
    ).toBe(true);
    expect(ok(tutorRequestSchema, { countryCode: 'ZZ' })).toBe(false);
    expect(ok(tutorRequestSchema, { countryCode: 'Testland', messages: [] })).toBe(false);
    expect(
      ok(tutorRequestSchema, { countryCode: 'ZZ', messages: Array.from({ length: 201 }, () => 1) }),
    ).toBe(false);
  });

  it('take a time zone as a short string', () => {
    expect(ok(timeZoneRequestSchema, { timeZone: 'America/New_York' })).toBe(true);
    expect(ok(timeZoneRequestSchema, { timeZone: '' })).toBe(false);
    expect(ok(timeZoneRequestSchema, { timeZone: 'x'.repeat(65) })).toBe(false);
    expect(ok(timeZoneRequestSchema, { timeZone: 5 })).toBe(false);
  });

  it('take an exam result as passed or failed', () => {
    expect(ok(examResultRequestSchema, { countryCode: 'ZZ', result: 'passed' })).toBe(true);
    expect(ok(examResultRequestSchema, { countryCode: 'zz', result: 'failed' })).toBe(true);
    expect(ok(examResultRequestSchema, { countryCode: 'ZZ', result: 'excellent' })).toBe(false);
    expect(ok(examResultRequestSchema, { countryCode: 'ZZZ', result: 'passed' })).toBe(false);
    expect(ok(examResultRequestSchema, { result: 'passed' })).toBe(false);
  });

  it('take a session result as whole, non-negative numbers', () => {
    expect(ok(sessionResultSchema, { correct: 7, total: 10, passed: true })).toBe(true);
    expect(ok(sessionResultSchema, { correct: 0, total: 0, passed: null })).toBe(true);
    expect(ok(sessionResultSchema, { correct: -1, total: 10, passed: null })).toBe(false);
    expect(ok(sessionResultSchema, { correct: '7', total: 10, passed: null })).toBe(false);
    expect(ok(sessionResultSchema, { correct: 7.5, total: 10, passed: null })).toBe(false);
    expect(ok(sessionResultSchema, { correct: 7, total: 100000, passed: null })).toBe(false);
    expect(ok(sessionResultSchema, { correct: 7, total: 10 })).toBe(false);
  });

  it('take at most 50 offline sessions, each with real ids', () => {
    const attempt = {
      attemptId: id,
      countryCode: 'ZZ',
      mode: 'practice',
      questionIds: [id],
      examFormatId: null,
      examQuestionIds: null,
      startedAt: '2026-10-08T10:00:00.000Z',
      result: null,
    };
    expect(ok(offlineAttemptsSchema, { attempts: [attempt] })).toBe(true);
    expect(ok(offlineAttemptsSchema, { attempts: [{ ...attempt, attemptId: 'a1' }] })).toBe(false);
    expect(ok(offlineAttemptsSchema, { attempts: [{ ...attempt, questionIds: ['q1'] }] })).toBe(
      false,
    );
    expect(ok(offlineAttemptsSchema, { attempts: Array.from({ length: 51 }, () => attempt) })).toBe(
      false,
    );
  });
});

describe('dashboardSchema', () => {
  const country = {
    countryCode: 'ZZ',
    countryName: 'Testland',
    isPrimary: true,
    examDate: '2026-10-01',
    readiness: null,
    publishedQuestions: 0,
    totalQuestions: 0,
    fullAccess: false,
    topics: [],
    exams: [],
    dueForReview: 0,
  };
  const dashboard = { streakDays: 0, minutesToday: 0, dailyGoalMinutes: 15 };

  it('reads a dashboard saved before exam results existed', () => {
    const parsed = dashboardSchema.parse({ ...dashboard, countries: [country] });
    expect(parsed.countries[0]).toMatchObject({ examResult: null, askExamResult: false });
  });

  it('carries the reported result and whether to ask for one', () => {
    const parsed = dashboardSchema.parse({
      ...dashboard,
      countries: [{ ...country, examResult: 'passed', askExamResult: false }],
    });
    expect(parsed.countries[0]!.examResult).toBe('passed');
    expect(
      ok(dashboardSchema, { ...dashboard, countries: [{ ...country, examResult: 'excellent' }] }),
    ).toBe(false);
  });
});
