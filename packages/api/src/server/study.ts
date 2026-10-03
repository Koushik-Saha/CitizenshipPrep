import { randomInt } from 'node:crypto';

import {
  buildMockExam,
  buildPracticeSet,
  createRandom,
  isDue,
  isValidTimeZone,
  minutesStudiedToday,
  readinessScore,
  reviewsFromEvents,
  studyStreak,
  topicMastery,
  type AnswerEvent,
  type PracticeMode,
} from '@oathly/core';
import type pg from 'pg';

import type {
  CountryDashboard,
  Dashboard,
  ReadinessView,
  SessionQuestion,
  StudyMode,
  StudySession,
} from '../study';
import { loadExamFormats, loadQuestionPool } from './quiz';

// Server side of the study app: the dashboard, starting sessions (which picks
// the questions with the quiz engine and stores the list), and loading a
// session in one go so the client can run it without further requests.
// Every function is scoped to a verified user id.

type Db = Pick<pg.Pool, 'query'>;

export class StudyError extends Error {
  override readonly name = 'StudyError';
}

const modeColumn: Record<StudyMode, 'practice' | 'review' | 'mock_exam'> = {
  practice: 'practice',
  flashcards: 'review',
  mock_exam: 'mock_exam',
};

const modeFromColumn = {
  practice: 'practice',
  review: 'flashcards',
  mock_exam: 'mock_exam',
} as const;

/** The learner's answers to questions of one country (or all countries), oldest first. */
async function answerHistory(db: Db, userId: string, countryCode?: string): Promise<AnswerEvent[]> {
  const { rows } = await db.query<{
    question_id: string;
    correct: boolean;
    time_ms: number;
    created_at: Date;
  }>(
    `select e.question_id, e.correct, e.time_ms, e.created_at
     from public.answer_events e
     join public.questions q on q.id = e.question_id
     where e.user_id = $1 and ($2::text is null or q.country_code = $2)
     order by e.created_at`,
    [userId, countryCode ?? null],
  );
  return rows.map((row) => ({
    questionId: row.question_id,
    correct: row.correct,
    timeMs: row.time_ms,
    answeredAt: row.created_at,
  }));
}

async function assertStudying(db: Db, userId: string, countryCode: string): Promise<void> {
  const { rowCount } = await db.query(
    'select 1 from public.user_countries where user_id = $1 and country_code = $2',
    [userId, countryCode],
  );
  if (!rowCount) throw new StudyError('Add this country to your study plan first.');
}

export async function setTimeZone(db: Db, userId: string, timeZone: string): Promise<void> {
  if (!isValidTimeZone(timeZone)) return;
  await db.query('update public.user_settings set time_zone = $2 where user_id = $1', [
    userId,
    timeZone,
  ]);
}

export async function getDashboard(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<Dashboard | null> {
  const settings = await db.query<{ daily_goal_minutes: number; time_zone: string }>(
    'select daily_goal_minutes, time_zone from public.user_settings where user_id = $1',
    [userId],
  );
  const setting = settings.rows[0];
  if (!setting) return null;

  const studying = await db.query<{
    country_code: string;
    name: string;
    is_primary: boolean;
    exam_date: string | null;
  }>(
    `select uc.country_code, c.name, uc.is_primary, to_char(uc.exam_date, 'YYYY-MM-DD') as exam_date
     from public.user_countries uc
     join public.countries c on c.iso_code = uc.country_code
     where uc.user_id = $1
     order by uc.is_primary desc, uc.created_at`,
    [userId],
  );

  const allHistory = await answerHistory(db, userId);
  const countries: CountryDashboard[] = [];
  for (const country of studying.rows) {
    const pool = await loadQuestionPool(db, country.country_code);
    const poolIds = new Set(pool.map((question) => question.id));
    const history = allHistory.filter((event) => poolIds.has(event.questionId));
    const mastery = topicMastery(pool, history, now);
    const reviews = reviewsFromEvents(history);
    const topicNames = await db.query<{ id: string; name: string }>(
      'select id, name from public.topics where country_code = $1 order by sort_order, name',
      [country.country_code],
    );
    const formats = await loadExamFormats(db, country.country_code);
    const names = new Map(topicNames.rows.map((topic) => [topic.id, topic.name]));
    const mocks = await db.query<{
      exam_format_id: string;
      submitted_at: Date;
      correct_count: number;
      total: number;
    }>(
      `select m.exam_format_id, m.submitted_at, m.correct_count, cardinality(m.question_ids) as total
       from public.mock_exams m
       join public.exam_formats f on f.id = m.exam_format_id
       where m.user_id = $1 and f.country_code = $2
         and m.submitted_at is not null and m.correct_count is not null
       order by m.submitted_at desc`,
      [userId, country.country_code],
    );
    // Measure against the exam the learner last sat as a mock, or else the
    // first current one that can be practised.
    const practisable = formats.filter((candidate) => candidate.questionCount !== null);
    const format =
      practisable.find((candidate) => candidate.id === mocks.rows[0]?.exam_format_id) ??
      practisable.find((candidate) => candidate.isCurrent) ??
      practisable[0] ??
      null;
    let readinessView: ReadinessView | null = null;
    if (pool.length > 0) {
      const estimate = readinessScore({
        pool,
        history,
        format,
        mocks: mocks.rows.map((row) => ({
          submittedAt: row.submitted_at,
          correct: row.correct_count,
          total: row.total,
        })),
        now,
      });
      const percent = (value: number) => Math.round(value * 100);
      readinessView = {
        score: estimate.score,
        isEarlyEstimate: estimate.isEarlyEstimate,
        knowledge: percent(estimate.knowledge),
        mockAverage: estimate.mockAverage === null ? null : percent(estimate.mockAverage),
        questionsSeen: estimate.questionsSeen,
        examName: format?.name ?? null,
        topics: estimate.topics.map((topic) => ({
          topicId: topic.topicId,
          name: names.get(topic.topicId) ?? 'Topic',
          share: percent(topic.share),
          mastery: percent(topic.mastery),
        })),
        suggestions: estimate.suggestions.map((suggestion) => {
          switch (suggestion.kind) {
            case 'topic':
              return {
                kind: 'topic',
                topicId: suggestion.topicId,
                name: names.get(suggestion.topicId) ?? 'Topic',
                share: percent(suggestion.share),
                mastery: percent(suggestion.mastery),
              };
            case 'mock':
              return { kind: 'mock', examFormatId: format!.id, examName: format!.name };
            default:
              return suggestion;
          }
        }),
      };
    }

    countries.push({
      countryCode: country.country_code,
      countryName: country.name,
      isPrimary: country.is_primary,
      examDate: country.exam_date,
      readiness: readinessView,
      publishedQuestions: pool.length,
      topics: topicNames.rows
        .filter((topic) => mastery.has(topic.id))
        .map((topic) => ({
          topicId: topic.id,
          name: topic.name,
          questions: mastery.get(topic.id)!.questions,
          mastery: Math.round(mastery.get(topic.id)!.score * 100),
        })),
      exams: formats
        .filter((format) => format.questionCount !== null)
        .map((format) => {
          let unavailableReason: string | null = null;
          try {
            buildMockExam(format, pool, { random: createRandom(1) });
          } catch (error) {
            unavailableReason =
              error instanceof Error && /region/.test(error.message)
                ? 'Needs your state or region, which Oathly does not ask for yet.'
                : `Needs ${format.questionCount} published questions; ${pool.length} are ready.`;
          }
          return {
            id: format.id,
            name: format.name,
            questionCount: format.questionCount!,
            timeLimitMinutes: format.timeLimitMinutes,
            passMark: format.passMark,
            isCurrent: format.isCurrent,
            unavailableReason,
          };
        }),
      dueForReview: [...reviews.values()].filter((review) => isDue(review, now)).length,
    });
  }

  return {
    streakDays: studyStreak(
      allHistory.map((event) => event.answeredAt),
      now,
      setting.time_zone,
    ),
    minutesToday: minutesStudiedToday(allHistory, now, setting.time_zone),
    dailyGoalMinutes: setting.daily_goal_minutes,
    countries,
  };
}

async function createAttempt(
  db: Db,
  userId: string,
  countryCode: string,
  mode: StudyMode,
  questionIds: string[],
  mockExamId: string | null = null,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.attempts (user_id, country_code, mode, mock_exam_id, question_ids, question_count)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [userId, countryCode, modeColumn[mode], mockExamId, questionIds, questionIds.length],
  );
  return rows[0]!.id;
}

export interface PracticeRequest {
  countryCode: string;
  mode: PracticeMode;
  topicId?: string;
  size: number;
}

/** Starts a practice session (or, with `flashcards`, a flashcard deck) and returns its id. */
export async function startPractice(
  db: Db,
  userId: string,
  request: PracticeRequest,
  kind: 'practice' | 'flashcards' = 'practice',
): Promise<string> {
  await assertStudying(db, userId, request.countryCode);
  const pool = await loadQuestionPool(db, request.countryCode);
  if (pool.length === 0) throw new StudyError('No questions are published for this country yet.');
  const set = buildPracticeSet(pool, {
    mode: request.mode,
    size: Math.min(Math.max(1, Math.trunc(request.size)), 100),
    topicIds: request.topicId ? [request.topicId] : undefined,
    history: await answerHistory(db, userId, request.countryCode),
    now: new Date(),
    random: createRandom(randomInt(2 ** 31)),
  });
  if (set.length === 0) throw new StudyError('No questions match that choice.');
  return createAttempt(
    db,
    userId,
    request.countryCode,
    kind,
    set.map((question) => question.id),
  );
}

/** Starts a mock exam in the real exam's format and returns the attempt id. */
export async function startMockExam(
  pool: pg.Pool,
  userId: string,
  request: { countryCode: string; examFormatId: string },
): Promise<string> {
  await assertStudying(pool, userId, request.countryCode);
  const format = (await loadExamFormats(pool, request.countryCode)).find(
    (candidate) => candidate.id === request.examFormatId,
  );
  if (!format) throw new StudyError('That exam is not available.');
  let exam;
  try {
    exam = buildMockExam(format, await loadQuestionPool(pool, request.countryCode), {
      random: createRandom(randomInt(2 ** 31)),
    });
  } catch (error) {
    throw new StudyError(error instanceof Error ? error.message : String(error));
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const mock = await client.query<{ id: string }>(
      `insert into public.mock_exams (user_id, exam_format_id, question_ids)
       values ($1, $2, $3) returning id`,
      // Section by section, so the sections can be rebuilt from the counts;
      // the attempt keeps the order they are asked in.
      [userId, format.id, exam.sections.flatMap((section) => section.questionIds)],
    );
    const attemptId = await createAttempt(
      client,
      userId,
      request.countryCode,
      'mock_exam',
      exam.questionIds,
      mock.rows[0]!.id,
    );
    await client.query('commit');
    return attemptId;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** Everything the client needs to run a session, or null if it is not this learner's. */
export async function loadStudySession(
  db: Db,
  userId: string,
  attemptId: string,
): Promise<StudySession | null> {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return null;
  const attempt = await db.query<{
    id: string;
    country_code: string;
    country_name: string;
    latitude: string | null;
    longitude: string | null;
    mode: keyof typeof modeFromColumn;
    started_at: Date;
    completed_at: Date | null;
    question_ids: string[];
    exam_format_id: string | null;
    study_locale: string | null;
  }>(
    `select a.id, a.country_code, c.name as country_name, c.latitude, c.longitude,
            a.mode, a.started_at, a.completed_at,
            a.question_ids, m.exam_format_id, uc.study_locale
     from public.attempts a
     join public.countries c on c.iso_code = a.country_code
     left join public.mock_exams m on m.id = a.mock_exam_id
     left join public.user_countries uc on uc.user_id = a.user_id and uc.country_code = a.country_code
     where a.id = $1 and a.user_id = $2`,
    [attemptId, userId],
  );
  const row = attempt.rows[0];
  if (!row) return null;

  const content = await db.query<{
    id: string;
    version: number;
    topic_id: string;
    topic_name: string;
    type: SessionQuestion['type'];
    correct_answer: { keys: string[] };
    source_quote: string | null;
    source_url: string;
    locale: string;
    text: string;
    options: { key: string; text: string }[];
    explanation: string | null;
  }>(
    `select q.id, q.version, q.topic_id, t.name as topic_name, q.type, q.correct_answer,
            q.source_quote, q.source_url, w.locale, w.text, w.options, w.explanation
     from public.questions q
     join public.topics t on t.id = q.topic_id
     join lateral (
       select tr.locale, tr.text, tr.options, tr.explanation
       from public.question_translations tr
       where tr.question_id = q.id and tr.status = 'approved'
         and (tr.locale = $2 or tr.translated_from is null)
       order by (tr.locale = $2) desc, (tr.translated_from is null) desc
       limit 1
     ) w on true
     where q.id = any($1::uuid[]) and q.status = 'published'`,
    [row.question_ids, row.study_locale],
  );
  const byId = new Map(content.rows.map((question) => [question.id, question]));
  const questions: SessionQuestion[] = row.question_ids.flatMap((id) => {
    const question = byId.get(id);
    return question
      ? [
          {
            id: question.id,
            version: question.version,
            topicId: question.topic_id,
            topicName: question.topic_name,
            type: question.type,
            locale: question.locale,
            text: question.text,
            options: question.options,
            correctKeys: question.correct_answer.keys,
            explanation: question.explanation,
            sourceQuote: question.source_quote,
            sourceUrl: question.source_url,
          },
        ]
      : [];
  });

  let exam: StudySession['exam'] = null;
  if (row.exam_format_id) {
    const format = (await loadExamFormats(db, row.country_code)).find(
      (candidate) => candidate.id === row.exam_format_id,
    );
    if (format) {
      const sections = format.blueprint.sections ?? [
        { id: 'all', label: format.name, count: row.question_ids.length, mustAllBeCorrect: false },
      ];
      // The attempt's questions were drawn section by section, in this order.
      let offset = 0;
      const sectionIds = new Map<string, string[]>();
      const drawn = await db.query<{ question_ids: string[] }>(
        'select m.question_ids from public.mock_exams m join public.attempts a on a.mock_exam_id = m.id where a.id = $1',
        [attemptId],
      );
      const ordered = drawn.rows[0]!.question_ids;
      for (const section of sections) {
        sectionIds.set(section.id, ordered.slice(offset, offset + section.count));
        offset += section.count;
      }
      exam = {
        name: format.name,
        questionCount: format.questionCount ?? questions.length,
        passMark: format.passMark,
        timeLimitMs: format.timeLimitMinutes === null ? null : format.timeLimitMinutes * 60_000,
        stopEarly: format.blueprint.stopEarly,
        sections: sections.map((section) => ({
          id: section.id,
          label: section.label,
          questionIds: sectionIds.get(section.id)!,
          mustAllBeCorrect: section.mustAllBeCorrect,
        })),
      };
    }
  }

  return {
    attemptId: row.id,
    countryCode: row.country_code,
    countryName: row.country_name,
    countryLocation:
      row.latitude === null || row.longitude === null
        ? null
        : { latitude: Number(row.latitude), longitude: Number(row.longitude) },
    mode: modeFromColumn[row.mode],
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    questions,
    exam,
  };
}

/** Records the end of a session. Calling it again changes nothing. */
export async function completeAttempt(
  pool: pg.Pool,
  userId: string,
  attemptId: string,
  result: { correct: number; total: number; passed: boolean | null },
): Promise<void> {
  if (
    !Number.isInteger(result.correct) ||
    !Number.isInteger(result.total) ||
    result.correct < 0 ||
    result.correct > result.total
  ) {
    throw new StudyError('Invalid result.');
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const updated = await client.query<{ mock_exam_id: string | null }>(
      `update public.attempts
       set completed_at = now(), correct_count = $3, question_count = $4
       where id = $1 and user_id = $2 and completed_at is null
       returning mock_exam_id`,
      [attemptId, userId, result.correct, result.total],
    );
    const mockExamId = updated.rows[0]?.mock_exam_id;
    if (mockExamId) {
      await client.query(
        `update public.mock_exams set submitted_at = now(), correct_count = $2, passed = $3
         where id = $1 and submitted_at is null`,
        [mockExamId, result.correct, result.passed],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
