import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { recordAnswers } from './quiz';
import {
  completeAttempt,
  getDashboard,
  loadStudySession,
  setTimeZone,
  startMockExam,
  startPractice,
  StudyError,
} from './study';

// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;
const USER = 'test:study-api';
const COUNTRY = 'ZX';

describe.skipIf(!url)('study sessions against the database', () => {
  let pool: pg.Pool;
  let formatId: string;

  // The learner first (their answers go with them), then the questions, then the reviewer who verified them.
  async function cleanUp() {
    await pool.query('delete from public.profiles where id = $1', [USER]);
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query(`delete from public.profiles where id = 'test:study-reviewer'`);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    await pool.query(`insert into public.profiles (id) values ($1), ('test:study-reviewer')`, [
      USER,
    ]);
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages) values ($1, 'Examland', true, '{en}')`,
      [COUNTRY],
    );
    formatId = (
      await pool.query<{ id: string }>(
        `insert into public.exam_formats (country_code, slug, name, format_type, question_count, pass_mark, time_limit_minutes, source_url)
         values ($1, 'written', 'Examland test', 'written', 6, 4, 10, 'https://example.test') returning id`,
        [COUNTRY],
      )
    ).rows[0]!.id;
    await pool.query(
      `insert into public.exam_formats (country_code, slug, name, format_type, question_count, pass_mark, source_url)
       values ($1, 'big', 'Examland long test', 'written', 50, 40, 'https://example.test')`,
      [COUNTRY],
    );
    const topic = (
      await pool.query<{ id: string }>(
        `insert into public.topics (country_code, slug, name) values ($1, 'civics', 'Civics') returning id`,
        [COUNTRY],
      )
    ).rows[0]!.id;
    // Eight published questions with English wording and a Spanish translation for the first,
    // plus one draft that must never be served.
    for (let i = 1; i <= 9; i += 1) {
      const published = i <= 8;
      const id = (
        await pool.query<{ id: string }>(
          `insert into public.questions (country_code, topic_id, difficulty, type, correct_answer, source_url, status, verified_by, last_verified_at)
           values ($1, $2, 2, 'multiple_choice', '{"keys": ["a"]}', 'https://example.test', $3, $4, $5) returning id`,
          [
            COUNTRY,
            topic,
            published ? 'published' : 'draft',
            published ? 'test:study-reviewer' : null,
            published ? new Date() : null,
          ],
        )
      ).rows[0]!.id;
      await pool.query(
        `insert into public.question_translations (question_id, locale, text, options, status, reviewed_by, reviewed_at)
         values ($1, 'en', $2, '[{"key":"a","text":"Yes"},{"key":"b","text":"No"}]', 'approved', 'test:study-reviewer', now())`,
        [id, `Question ${i}`],
      );
      if (i === 1) {
        await pool.query(
          `insert into public.question_translations (question_id, locale, text, options, translated_from, status, reviewed_by, reviewed_at)
           values ($1, 'es', 'Pregunta 1', '[{"key":"a","text":"Sí"},{"key":"b","text":"No"}]', 'en', 'approved', 'test:study-reviewer', now())`,
          [id],
        );
      }
    }
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('will not start a session for a country the learner does not study', async () => {
    await expect(
      startPractice(pool, USER, { countryCode: COUNTRY, mode: 'random', size: 5 }),
    ).rejects.toThrow(StudyError);
    await pool.query(
      `insert into public.user_settings (user_id, daily_goal_minutes) values ($1, 10)`,
      [USER],
    );
    await pool.query(
      `insert into public.user_countries (user_id, country_code, study_locale, is_primary) values ($1, $2, 'es', true)`,
      [USER, COUNTRY],
    );
  });

  it('starts practice from published questions only, and loads it in the study language where translated', async () => {
    const attemptId = await startPractice(pool, USER, {
      countryCode: COUNTRY,
      mode: 'random',
      size: 20,
    });
    const session = (await loadStudySession(pool, USER, attemptId))!;
    expect(session.mode).toBe('practice');
    expect(session.questions).toHaveLength(8);
    expect(session.questions.some((question) => question.text === 'Question 9')).toBe(false);
    const translated = session.questions.find((question) => question.locale === 'es');
    expect(translated).toMatchObject({
      text: 'Pregunta 1',
      options: [
        { key: 'a', text: 'Sí' },
        { key: 'b', text: 'No' },
      ],
    });
    expect(session.questions.filter((question) => question.locale === 'en')).toHaveLength(7);
    expect(session.exam).toBeNull();
  });

  it('starts flashcards as a review session', async () => {
    const attemptId = await startPractice(
      pool,
      USER,
      { countryCode: COUNTRY, mode: 'weak', size: 3 },
      'flashcards',
    );
    expect((await loadStudySession(pool, USER, attemptId))!.mode).toBe('flashcards');
  });

  it('starts a mock exam in the exam’s format, and refuses one the pool cannot fill', async () => {
    const attemptId = await startMockExam(pool, USER, {
      countryCode: COUNTRY,
      examFormatId: formatId,
    });
    const session = (await loadStudySession(pool, USER, attemptId))!;
    expect(session.mode).toBe('mock_exam');
    expect(session.questions).toHaveLength(6);
    expect(session.exam).toMatchObject({
      name: 'Examland test',
      questionCount: 6,
      passMark: 4,
      timeLimitMs: 600_000,
      stopEarly: false,
    });
    expect([...session.exam!.sections[0]!.questionIds].sort()).toEqual(
      session.questions.map((q) => q.id).sort(),
    );

    const big = (
      await pool.query<{ id: string }>(
        `select id from public.exam_formats where country_code = $1 and slug = 'big'`,
        [COUNTRY],
      )
    ).rows[0]!.id;
    await expect(
      startMockExam(pool, USER, { countryCode: COUNTRY, examFormatId: big }),
    ).rejects.toThrow('needs 50 questions but only 8');
    await expect(
      startMockExam(pool, USER, {
        countryCode: COUNTRY,
        examFormatId: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toThrow('That exam is not available.');

    await completeAttempt(pool, USER, attemptId, { correct: 5, total: 6, passed: true });
    await completeAttempt(pool, USER, attemptId, { correct: 0, total: 6, passed: false });
    const stored = await pool.query(
      `select a.correct_count, a.completed_at is not null as done, m.passed, m.correct_count as mock_correct
       from public.attempts a join public.mock_exams m on m.id = a.mock_exam_id where a.id = $1`,
      [attemptId],
    );
    expect(stored.rows[0]).toEqual({ correct_count: 5, done: true, passed: true, mock_correct: 5 });
    expect((await loadStudySession(pool, USER, attemptId))!.completedAt).not.toBeNull();
    await expect(
      completeAttempt(pool, USER, attemptId, { correct: 7, total: 6, passed: true }),
    ).rejects.toThrow('Invalid result.');
  });

  it('keeps sessions private to their learner', async () => {
    const attemptId = await startPractice(pool, USER, {
      countryCode: COUNTRY,
      mode: 'random',
      size: 2,
    });
    expect(await loadStudySession(pool, 'test:someone-else', attemptId)).toBeNull();
    expect(await loadStudySession(pool, USER, 'not-an-id')).toBeNull();
  });

  it('builds the dashboard from the learner’s answers', async () => {
    const attemptId = await startPractice(pool, USER, {
      countryCode: COUNTRY,
      mode: 'random',
      size: 8,
    });
    const session = (await loadStudySession(pool, USER, attemptId))!;
    const now = new Date();
    await recordAnswers(
      pool,
      USER,
      session.questions.slice(0, 4).map((question, i) => ({
        clientEventId: `6f1c1f7e-0000-4000-8000-00000000000${i}`,
        attemptId,
        questionId: question.id,
        questionVersion: 1,
        selectedKeys: ['a'],
        correct: true,
        timeMs: 90_000,
        answeredAt: now.toISOString(),
      })),
    );
    await setTimeZone(pool, USER, 'Not/AZone');
    await setTimeZone(pool, USER, 'Europe/Berlin');
    const dashboard = (await getDashboard(pool, USER, now))!;
    expect(dashboard).toMatchObject({ streakDays: 1, minutesToday: 6, dailyGoalMinutes: 10 });
    const country = dashboard.countries[0]!;
    expect(country).toMatchObject({ countryCode: COUNTRY, publishedQuestions: 8, readiness: 17 });
    expect(country.topics).toEqual([
      { topicId: expect.any(String), name: 'Civics', questions: 8, mastery: 17 },
    ]);
    expect(country.exams.map((exam) => [exam.name, exam.unavailableReason])).toEqual([
      ['Examland long test', 'Needs 50 published questions; 8 are ready.'],
      ['Examland test', null],
    ]);
    expect(await getDashboard(pool, 'test:nobody', now)).toBeNull();
  });
});
