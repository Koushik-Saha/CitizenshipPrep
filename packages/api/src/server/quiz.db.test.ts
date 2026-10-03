import { buildMockExam, createRandom, examDecision, type QuizQuestion } from '@oathly/core';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadExamFormats, loadQuestionPool, recordAnswers } from './quiz';

// Needs the local database with the seed (`pnpm db:start`); skipped otherwise.
const url = process.env.TEST_DATABASE_URL;

/**
 * The real exams, from the official sources cited in the seed. This is the
 * yardstick the seeded formats and the mock exams built from them are checked
 * against, kept separate from the seed on purpose.
 */
const realFormats = [
  {
    country: 'US',
    slug: 'civics-2025',
    questions: 20,
    passMark: 12,
    minutes: null,
    stopEarly: true,
    sections: { all: 20 },
  },
  {
    country: 'US',
    slug: 'civics-2008',
    questions: 10,
    passMark: 6,
    minutes: null,
    stopEarly: true,
    sections: { all: 10 },
  },
  {
    country: 'CA',
    slug: 'citizenship-test',
    questions: 20,
    passMark: 15,
    minutes: 45,
    stopEarly: false,
    sections: { all: 20 },
  },
  {
    country: 'GB',
    slug: 'life-in-the-uk',
    questions: 24,
    passMark: 18,
    minutes: 45,
    stopEarly: false,
    sections: { all: 24 },
  },
  {
    country: 'AU',
    slug: 'citizenship-test',
    questions: 20,
    passMark: 15,
    minutes: 45,
    stopEarly: false,
    sections: { values: 5, general: 15 },
  },
  {
    country: 'DE',
    slug: 'einbuergerungstest',
    questions: 33,
    passMark: 17,
    minutes: 60,
    stopEarly: false,
    sections: { general: 30, state: 3 },
  },
];

describe.skipIf(!url)('quiz engine against the seeded exam formats', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: url });
  });
  afterAll(async () => {
    await pool.query(`delete from public.profiles where id = 'test-learner-quiz'`);
    await pool.end();
  });

  /** A pool big enough for any exam: 40 questions per topic of the country, plus 5 per test region. */
  async function questionPool(country: string): Promise<QuizQuestion[]> {
    const topics = await pool.query<{ id: string; slug: string }>(
      'select id, slug from public.topics where country_code = $1',
      [country],
    );
    const questions = topics.rows.flatMap((topic) =>
      Array.from({ length: 40 }, (_, i) => ({
        id: `${topic.slug}-${i}`,
        topicId: topic.id,
        topicSlug: topic.slug,
        difficulty: 2,
        type: 'multiple_choice' as const,
        correctKeys: ['a'],
        regionCode: null,
        version: 1,
      })),
    );
    const regional = Array.from({ length: 5 }, (_, i) => ({
      ...questions[0]!,
      id: `regional-${i}`,
      regionCode: 'DE-BE',
    }));
    return [...questions, ...regional];
  }

  it.each(realFormats)(
    '$country $slug: the seeded format and a mock exam match the real exam',
    async (real) => {
      const formats = await loadExamFormats(pool, real.country);
      const format = formats.find((candidate) => candidate.slug === real.slug)!;
      expect(format).toMatchObject({
        questionCount: real.questions,
        passMark: real.passMark,
        timeLimitMinutes: real.minutes,
      });

      const exam = buildMockExam(format, await questionPool(real.country), {
        random: createRandom(2026),
        region: 'DE-BE',
      });
      expect(exam.questionIds).toHaveLength(real.questions);
      expect(new Set(exam.questionIds).size).toBe(real.questions);
      expect(exam.passMark).toBe(real.passMark);
      expect(exam.timeLimitMs).toBe(real.minutes === null ? null : real.minutes * 60_000);
      expect(exam.stopEarly).toBe(real.stopEarly);
      expect(
        Object.fromEntries(
          exam.sections.map((section) => [section.id, section.questionIds.length]),
        ),
      ).toEqual(real.sections);
    },
  );

  it('AU: every values question must be right, and only values questions are in that section', async () => {
    const format = (await loadExamFormats(pool, 'AU')).find(
      (candidate) => candidate.slug === 'citizenship-test',
    )!;
    const exam = buildMockExam(format, await questionPool('AU'), { random: createRandom(1) });
    const values = exam.sections.find((section) => section.id === 'values')!;
    expect(values.mustAllBeCorrect).toBe(true);
    expect(values.questionIds.every((id) => id.startsWith('australian-values-'))).toBe(true);
    const general = exam.sections.find((section) => section.id === 'general')!;
    expect(general.questionIds.some((id) => id.startsWith('australian-values-'))).toBe(false);
  });

  it('DE: the three state questions come from the learner’s Bundesland', async () => {
    const format = (await loadExamFormats(pool, 'DE')).find(
      (candidate) => candidate.slug === 'einbuergerungstest',
    )!;
    const exam = buildMockExam(format, await questionPool('DE'), {
      random: createRandom(1),
      region: 'DE-BE',
    });
    expect(
      exam.sections
        .find((section) => section.id === 'state')!
        .questionIds.every((id) => id.startsWith('regional-')),
    ).toBe(true);
  });

  it('US 2025: the officer stops at 12 right or 9 wrong, as USCIS describes', async () => {
    const format = (await loadExamFormats(pool, 'US')).find(
      (candidate) => candidate.slug === 'civics-2025',
    )!;
    const questions = await questionPool('US');
    const exam = buildMockExam(format, questions, { random: createRandom(1) });
    const answer = (id: string, key: string) => ({
      questionId: id,
      selectedKeys: [key],
      timeMs: 3_000,
      answeredAt: new Date(),
    });
    const asked = exam.questionIds;
    expect(
      examDecision(
        exam,
        questions,
        asked.slice(0, 12).map((id) => answer(id, 'a')),
      ),
    ).toBe('passed');
    expect(
      examDecision(
        exam,
        questions,
        asked.slice(0, 8).map((id) => answer(id, 'b')),
      ),
    ).toBeNull();
    expect(
      examDecision(
        exam,
        questions,
        asked.slice(0, 9).map((id) => answer(id, 'b')),
      ),
    ).toBe('failed');
  });

  it('formats without a fixed question count are loaded but cannot become a mock exam', async () => {
    const english = (await loadExamFormats(pool, 'US')).find(
      (candidate) => candidate.slug === 'english',
    )!;
    expect(english).toMatchObject({ formatType: 'language', questionCount: null });
    expect(() => buildMockExam(english, [], { random: createRandom(1) })).toThrow(
      'no fixed number of questions',
    );
  });

  it('serves only published questions', async () => {
    const before = await loadQuestionPool(pool, 'US');
    expect(before.every((question) => question.correctKeys.length > 0)).toBe(true);
    const count = await pool.query<{ n: string }>(
      `select count(*) as n from public.questions where country_code = 'US' and status = 'published'`,
    );
    expect(before).toHaveLength(Number(count.rows[0]!.n));
  });

  describe('recordAnswers', () => {
    const user = 'test-learner-quiz';
    let attemptId: string;
    let questionId: string;
    const answer = (clientEventId: string, overrides = {}) => ({
      clientEventId,
      attemptId,
      questionId,
      questionVersion: 1,
      selectedKeys: ['a'],
      correct: true,
      timeMs: 4_000,
      answeredAt: '2026-10-03T10:00:00.000Z',
      ...overrides,
    });

    beforeAll(async () => {
      await pool.query(`insert into public.profiles (id) values ($1) on conflict do nothing`, [
        user,
      ]);
      attemptId = (
        await pool.query<{ id: string }>(
          `insert into public.attempts (user_id, country_code) values ($1, 'US') returning id`,
          [user],
        )
      ).rows[0]!.id;
      questionId = (
        await pool.query<{ id: string }>(
          `select id from public.questions where country_code = 'US' limit 1`,
        )
      ).rows[0]!.id;
    });

    it('stores new answers once, however often they are sent', async () => {
      const first = await recordAnswers(pool, user, [
        answer('7d1c1f7e-0000-4000-8000-000000000001'),
      ]);
      expect(first).toEqual({ accepted: ['7d1c1f7e-0000-4000-8000-000000000001'], rejected: [] });
      const again = await recordAnswers(pool, user, [
        answer('7d1c1f7e-0000-4000-8000-000000000001'),
      ]);
      expect(again.accepted).toEqual(['7d1c1f7e-0000-4000-8000-000000000001']);
      const stored = await pool.query('select 1 from public.answer_events where user_id = $1', [
        user,
      ]);
      expect(stored.rowCount).toBe(1);
    });

    it('refuses for good what can never be stored', async () => {
      const outcome = await recordAnswers(pool, user, [
        answer('not-a-uuid'),
        answer('7d1c1f7e-0000-4000-8000-000000000002', {
          attemptId: '00000000-0000-4000-8000-000000000000',
        }),
        answer('7d1c1f7e-0000-4000-8000-000000000003', { timeMs: -1 }),
        answer('7d1c1f7e-0000-4000-8000-000000000004', { answeredAt: 'yesterday' }),
        answer('7d1c1f7e-0000-4000-8000-000000000005', { questionVersion: 0 }),
        answer('7d1c1f7e-0000-4000-8000-000000000006', { questionId: 'nope' }),
      ]);
      expect(outcome.accepted).toEqual([]);
      expect(outcome.rejected.map((entry) => [entry.reason, entry.permanent])).toEqual([
        ['clientEventId must be a UUID.', true],
        ['Unknown attempt or question.', true],
        ['Invalid answer time.', true],
        ['Invalid answer timestamp.', true],
        ['Invalid question version.', true],
        ['Unknown attempt or question.', true],
      ]);
    });

    it('will not attach an answer to someone else’s attempt', async () => {
      const outcome = await recordAnswers(pool, 'test-someone-else-quiz', [
        answer('7d1c1f7e-0000-4000-8000-000000000007'),
      ]);
      expect(outcome.rejected[0]).toMatchObject({ permanent: true });
    });
  });
});
