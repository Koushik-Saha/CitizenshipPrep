import { randomUUID } from 'node:crypto';

import { rateLimitKey, rateLimitRules } from '@oathly/core';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ensureProfile, reportExamResult, saveOnboarding } from './me';
import { recordAnswers, recordAnswersNotingFirst } from './quiz';
import { pruneRateLimits, takeRateLimit } from './rate-limit';
import { completeAttempt, getDashboard, startMockExam, startPractice } from './study';

// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;
// A code no real country uses, and unlike the other test files' codes.
const COUNTRY = 'ZQ';
const LEARNER = 'test:milestones-learner';
const OTHER = 'test:milestones-other';
const REVIEWER = 'test:milestones-reviewer';
const KEY = `test-milestones-${randomUUID()}`;

describe.skipIf(!url)('rate limits, exam results and counted moments against the database', () => {
  let pool: pg.Pool;
  let examFormatId: string;

  const cleanUp = async () => {
    await pool.query('delete from public.rate_limits where key like $1', ['test-milestones-%']);
    await pool.query('delete from public.profiles where id = any($1)', [[LEARNER, OTHER]]);
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
    await pool.query('delete from public.profiles where id = $1', [REVIEWER]);
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    await pool.query(`insert into public.profiles (id, display_name) values ($1, 'Reviewer')`, [
      REVIEWER,
    ]);
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages)
       values ($1, 'Milestoneland', true, '{en}')`,
      [COUNTRY],
    );
    const format = await pool.query<{ id: string }>(
      `insert into public.exam_formats
         (country_code, slug, name, format_type, question_count, pass_mark, source_url)
       values ($1, 'test', 'Knowledge test', 'written', 2, 1, 'https://example.org/test')
       returning id`,
      [COUNTRY],
    );
    examFormatId = format.rows[0]!.id;
    const topic = await pool.query<{ id: string }>(
      `insert into public.topics (country_code, slug, name) values ($1, 'civics', 'Civics')
       returning id`,
      [COUNTRY],
    );
    const questions = await pool.query<{ id: string }>(
      `insert into public.questions
         (country_code, topic_id, difficulty, type, correct_answer, source_url, status,
          verified_by, last_verified_at)
       select $1, $2, 1, 'multiple_choice', '{"keys": ["a"]}', 'https://example.org/guide',
              'published', $3, now()
       from generate_series(1, 3)
       returning id`,
      [COUNTRY, topic.rows[0]!.id, REVIEWER],
    );
    for (const question of questions.rows) {
      await pool.query(
        `insert into public.question_translations
           (question_id, locale, text, options, status, reviewed_by, reviewed_at)
         values ($1, 'en', 'A question?', '[{"key":"a","text":"A"},{"key":"b","text":"B"}]',
                 'approved', $2, now())`,
        [question.id, REVIEWER],
      );
    }
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  describe('takeRateLimit', () => {
    const rule = { limit: 3, windowSeconds: 60 };
    const at = (time: string) => new Date(`2026-10-08T${time}Z`);

    it('allows calls up to the limit, then refuses until the window ends', async () => {
      const decisions = [];
      for (let i = 0; i < 5; i += 1) {
        decisions.push(await takeRateLimit(pool, KEY, rule, at('10:15:10')));
      }
      expect(decisions.map((decision) => decision.allowed)).toEqual([
        true,
        true,
        true,
        false,
        false,
      ]);
      expect(decisions.map((decision) => decision.remaining)).toEqual([2, 1, 0, 0, 0]);
      expect(decisions[3]!.retryAfterSeconds).toBe(50);
    });

    it('starts afresh in the next window, and keeps callers apart', async () => {
      expect((await takeRateLimit(pool, KEY, rule, at('10:16:00'))).allowed).toBe(true);
      expect((await takeRateLimit(pool, `${KEY}-other`, rule, at('10:15:10'))).remaining).toBe(2);
    });

    it('counts calls that arrive together', async () => {
      const key = `${KEY}-together`;
      const decisions = await Promise.all(
        Array.from({ length: 8 }, () => takeRateLimit(pool, key, rule, at('10:20:00'))),
      );
      expect(decisions.filter((decision) => decision.allowed)).toHaveLength(3);
    });

    it('works with the real rules and key shape', async () => {
      const key = rateLimitKey('explain', 'user', KEY);
      const decision = await takeRateLimit(pool, `test-milestones-${key}`, rateLimitRules.explain);
      expect(decision).toMatchObject({ allowed: true, limit: 20, remaining: 19 });
    });

    it('prunes counters whose windows ended more than a day ago', async () => {
      const old = `${KEY}-old`;
      await takeRateLimit(pool, old, rule, new Date('2026-01-01T00:00:00Z'));
      expect(await pruneRateLimits(pool, new Date('2026-10-09T12:00:00Z'))).toBeGreaterThanOrEqual(
        1,
      );
      const { rows } = await pool.query('select 1 from public.rate_limits where key = $1', [old]);
      expect(rows).toHaveLength(0);
    });
  });

  describe('a learner', () => {
    const today = new Date().toISOString().slice(0, 10);
    const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);

    it('is created once: only the first sight of them is a signup', async () => {
      expect(await ensureProfile(pool, LEARNER, 'Lee')).toBe(true);
      expect(await ensureProfile(pool, LEARNER, 'Lee')).toBe(false);
      await ensureProfile(pool, OTHER, null);
    });

    it('is asked how the exam went once its date has come, and not before', async () => {
      await saveOnboarding(pool, LEARNER, {
        countryCode: COUNTRY,
        examDate: today,
        studyLocale: 'en',
        dailyGoalMinutes: 10,
      });
      const [country] = (await getDashboard(pool, LEARNER))!.countries;
      expect(country).toMatchObject({ examResult: null, askExamResult: true });

      await saveOnboarding(pool, OTHER, {
        countryCode: COUNTRY,
        examDate: nextYear,
        studyLocale: 'en',
        dailyGoalMinutes: 10,
      });
      expect((await getDashboard(pool, OTHER))!.countries[0]).toMatchObject({
        examResult: null,
        askExamResult: false,
      });
    });

    it('reports their own result, which can be corrected, and nobody else’s', async () => {
      expect(await reportExamResult(pool, LEARNER, COUNTRY.toLowerCase(), 'failed')).toBe(true);
      expect((await getDashboard(pool, LEARNER))!.countries[0]).toMatchObject({
        examResult: 'failed',
        askExamResult: false,
      });
      expect(await reportExamResult(pool, LEARNER, COUNTRY, 'passed')).toBe(true);
      expect((await getDashboard(pool, LEARNER))!.countries[0]!.examResult).toBe('passed');
      // The other learner's is untouched, and a country not studied is refused.
      expect((await getDashboard(pool, OTHER))!.countries[0]!.examResult).toBeNull();
      expect(await reportExamResult(pool, LEARNER, 'US', 'passed')).toBe(false);
    });

    it('answers a first question once', async () => {
      const attemptId = await startPractice(
        pool,
        LEARNER,
        { countryCode: COUNTRY, mode: 'random', size: 2 },
        'practice',
      );
      const { rows } = await pool.query<{ id: string; version: number }>(
        `select q.id, q.version from public.questions q where q.country_code = $1 limit 2`,
        [COUNTRY],
      );
      const answer = (question: { id: string; version: number }) => ({
        clientEventId: randomUUID(),
        attemptId,
        questionId: question.id,
        questionVersion: question.version,
        selectedKeys: ['a'],
        correct: true,
        timeMs: 1200,
        answeredAt: new Date().toISOString(),
      });

      // Nothing stored is not a first answer.
      const nothing = await recordAnswersNotingFirst(pool, LEARNER, [{ clientEventId: 'nope' }]);
      expect(nothing.firstAnswer).toBeNull();
      expect(nothing.outcome.rejected).toEqual([
        { clientEventId: 'nope', reason: 'clientEventId must be a UUID.', permanent: true },
      ]);

      const first = await recordAnswersNotingFirst(pool, LEARNER, [answer(rows[0]!)]);
      expect(first.outcome.accepted).toHaveLength(1);
      expect(first.firstAnswer).toEqual({ countryCode: COUNTRY });

      const second = await recordAnswersNotingFirst(pool, LEARNER, [answer(rows[1]!)]);
      expect(second.outcome.accepted).toHaveLength(1);
      expect(second.firstAnswer).toBeNull();
    });

    it('refuses malformed answers one by one, whatever they are', async () => {
      const outcome = await recordAnswers(pool, LEARNER, [
        null,
        'an answer',
        { clientEventId: randomUUID(), attemptId: 'x' },
        {
          clientEventId: randomUUID(),
          attemptId: randomUUID(),
          questionId: randomUUID(),
          questionVersion: 1,
          selectedKeys: 'a',
          correct: true,
          timeMs: 1,
          answeredAt: new Date().toISOString(),
        },
      ]);
      expect(outcome.accepted).toEqual([]);
      expect(outcome.rejected.map((answer) => answer.reason)).toEqual([
        expect.any(String),
        expect.any(String),
        'Unknown attempt or question.',
        'Invalid answer.',
      ]);
      expect(outcome.rejected.every((answer) => answer.permanent)).toBe(true);
      expect(outcome.rejected[0]!.clientEventId).toBe('');
    });

    it('finishes a mock exam once, and a practice session is not one', async () => {
      const mock = await startMockExam(pool, LEARNER, { countryCode: COUNTRY, examFormatId });
      const result = { correct: 2, total: 2, passed: true };
      expect(await completeAttempt(pool, LEARNER, mock, result)).toEqual({
        mockExam: { countryCode: COUNTRY },
      });
      // Again changes nothing, and is not a second exam.
      expect(await completeAttempt(pool, LEARNER, mock, result)).toEqual({ mockExam: null });
      // Somebody else finishing it finishes nothing.
      const theirs = await startMockExam(pool, LEARNER, { countryCode: COUNTRY, examFormatId });
      expect(await completeAttempt(pool, OTHER, theirs, result)).toEqual({ mockExam: null });

      const practice = await startPractice(
        pool,
        LEARNER,
        { countryCode: COUNTRY, mode: 'random', size: 2 },
        'practice',
      );
      expect(
        await completeAttempt(pool, LEARNER, practice, { correct: 1, total: 2, passed: null }),
      ).toEqual({ mockExam: null });
    });
  });
});
