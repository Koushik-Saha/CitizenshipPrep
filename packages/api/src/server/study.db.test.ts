import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { recordAnswers } from './quiz';
import { createRandom } from '@oathly/core';

import { startOfflineSession } from '../pack';
import { countryPackSchema } from '../schemas';
import {
  completeAttempt,
  getCountryPack,
  getDashboard,
  loadStudySession,
  registerOfflineAttempts,
  setTimeZone,
  startMockExam,
  startPractice,
  startSession,
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
      { countryCode: COUNTRY, mode: 'adaptive', size: 3 },
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
    expect(country).toMatchObject({
      countryCode: COUNTRY,
      publishedQuestions: 8,
      readiness: {
        // Four of eight questions is already a third of this small pool.
        isEarlyEstimate: false,
        questionsSeen: 4,
        // The exam last sat as a mock, not just the first one listed.
        examName: 'Examland test',
        // The completed mock exam (5 of 6) counts; four questions answered once, only
        // just now, count for little (7% mastery) until they are reviewed on schedule.
        mockAverage: 83,
      },
    });
    expect(country.readiness!.score).toBeGreaterThan(20);
    expect(country.readiness!.topics).toEqual([
      { topicId: expect.any(String), name: 'Civics', share: 100, mastery: 7 },
    ]);
    expect(country.topics).toEqual([
      { topicId: expect.any(String), name: 'Civics', questions: 8, mastery: 7 },
    ]);
    expect(country.exams.map((exam) => [exam.name, exam.unavailableReason])).toEqual([
      ['Examland long test', 'Needs 50 published questions; 8 are ready.'],
      ['Examland test', null],
    ]);
    expect(await getDashboard(pool, 'test:nobody', now)).toBeNull();
  });

  it('starts whichever session a client asks for', async () => {
    const practice = await startSession(pool, USER, {
      kind: 'flashcards',
      countryCode: COUNTRY,
      focus: 'random',
      size: 3,
    });
    expect((await loadStudySession(pool, USER, practice))!.mode).toBe('flashcards');
    const exam = await startSession(pool, USER, {
      kind: 'mock_exam',
      countryCode: COUNTRY,
      examFormatId: formatId,
    });
    expect((await loadStudySession(pool, USER, exam))!.exam?.name).toBe('Examland test');
  });

  it('packs a country for offline study: published questions, formats and history', async () => {
    const pack = await getCountryPack(pool, USER, COUNTRY.toLowerCase());
    expect(countryPackSchema.parse(JSON.parse(JSON.stringify(pack)))).toEqual(pack);
    expect(pack.countryName).toBe('Examland');
    expect(pack.questions).toHaveLength(8);
    expect(pack.questions.every((question) => question.topicSlug === 'civics')).toBe(true);
    expect(pack.examFormats.map((format) => format.name).sort()).toEqual([
      'Examland long test',
      'Examland test',
    ]);
    expect(pack.history.length).toBeGreaterThan(0);
    await expect(getCountryPack(pool, 'test:someone-else', COUNTRY)).rejects.toThrow(StudyError);
  });

  it('records sessions started offline, once, with the phone’s ids', async () => {
    const pack = await getCountryPack(pool, USER, COUNTRY);
    const now = new Date();
    const practice = startOfflineSession(
      pack,
      { kind: 'practice', countryCode: COUNTRY, focus: 'random', size: 3 },
      { attemptId: '0ff11e00-0000-4000-8000-000000000001', now, random: createRandom(3) },
    );
    const exam = startOfflineSession(
      pack,
      { kind: 'mock_exam', countryCode: COUNTRY, examFormatId: formatId },
      { attemptId: '0ff11e00-0000-4000-8000-000000000002', now, random: createRandom(4) },
    );
    await registerOfflineAttempts(pool, USER, [practice.attempt, exam.attempt]);

    // The server now serves the same sessions the phone built.
    const stored = (await loadStudySession(pool, USER, exam.attempt.attemptId))!;
    expect(stored.questions.map((q) => q.id)).toEqual(exam.session.questions.map((q) => q.id));
    expect(stored.exam?.sections).toEqual(exam.session.exam?.sections);
    expect(stored.completedAt).toBeNull();

    // Answers queued on the phone attach to it.
    const question = practice.session.questions[0]!;
    const outcome = await recordAnswers(pool, USER, [
      {
        clientEventId: '0ff11e00-0000-4000-8000-0000000000aa',
        attemptId: practice.attempt.attemptId,
        questionId: question.id,
        questionVersion: question.version,
        selectedKeys: question.correctKeys,
        correct: true,
        timeMs: 2000,
        answeredAt: now.toISOString(),
      },
    ]);
    expect(outcome.accepted).toHaveLength(1);

    // Sent again with the result, it is finished rather than duplicated.
    await registerOfflineAttempts(pool, USER, [
      { ...exam.attempt, result: { correct: 5, total: 6, passed: true } },
    ]);
    await registerOfflineAttempts(pool, USER, [
      { ...exam.attempt, result: { correct: 0, total: 6, passed: false } },
    ]);
    const done = await pool.query(
      `select count(*)::int as attempts, max(a.correct_count) as correct, bool_and(m.passed) as passed
       from public.attempts a join public.mock_exams m on m.id = a.mock_exam_id
       where a.id = $1`,
      [exam.attempt.attemptId],
    );
    expect(done.rows[0]).toEqual({ attempts: 1, correct: 5, passed: true });
  });

  it('refuses offline sessions that do not check out', async () => {
    const pack = await getCountryPack(pool, USER, COUNTRY);
    const { attempt } = startOfflineSession(
      pack,
      { kind: 'practice', countryCode: COUNTRY, focus: 'random', size: 2 },
      {
        attemptId: '0ff11e00-0000-4000-8000-000000000003',
        now: new Date(),
        random: createRandom(5),
      },
    );
    const refuse = (change: Partial<typeof attempt>, as = USER) =>
      expect(registerOfflineAttempts(pool, as, [{ ...attempt, ...change }])).rejects.toThrow(
        StudyError,
      );
    await refuse({ attemptId: 'nope' });
    await refuse({ questionIds: [] });
    await refuse({ questionIds: ['00000000-0000-4000-8000-00000000dead'] });
    await refuse({ startedAt: 'yesterday' });
    await refuse({ mode: 'mock_exam' });
    await refuse({ mode: 'mock_exam', examFormatId: formatId, examQuestionIds: [] });
    await refuse({}, 'test:someone-else');
    // Another learner cannot take over an id that is already in use.
    await registerOfflineAttempts(pool, USER, [attempt]);
    await pool.query(
      `insert into public.profiles (id) values ('test:study-other') on conflict do nothing`,
    );
    await pool.query(
      `insert into public.user_countries (user_id, country_code) values ('test:study-other', $1)`,
      [COUNTRY],
    );
    try {
      await refuse({}, 'test:study-other');
    } finally {
      await pool.query(`delete from public.profiles where id = 'test:study-other'`);
    }
  });
});
