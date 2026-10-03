import {
  parseBlueprint,
  type ExamFormat,
  type QueuedAnswer,
  type QuizQuestion,
  type SyncOutcome,
} from '@oathly/core';
import type pg from 'pg';

// Loads content into the quiz engine's shapes, and stores answers sent from
// a client's offline queue.

type Db = Pick<pg.Pool, 'query'>;

export interface CountryExamFormat extends ExamFormat {
  countryCode: string;
  slug: string;
  formatType: 'written' | 'oral' | 'interview' | 'language';
  isCurrent: boolean;
}

export async function loadExamFormats(db: Db, countryCode: string): Promise<CountryExamFormat[]> {
  const { rows } = await db.query<{
    id: string;
    country_code: string;
    slug: string;
    name: string;
    format_type: CountryExamFormat['formatType'];
    question_count: number | null;
    pass_mark: number | null;
    time_limit_minutes: number | null;
    is_current: boolean;
    blueprint: unknown;
  }>(
    `select id, country_code, slug, name, format_type, question_count, pass_mark,
            time_limit_minutes, is_current, blueprint
     from public.exam_formats
     where country_code = $1
     order by is_current desc, slug`,
    [countryCode],
  );
  return rows.map((row) => ({
    id: row.id,
    countryCode: row.country_code,
    slug: row.slug,
    name: row.name,
    formatType: row.format_type,
    questionCount: row.question_count,
    passMark: row.pass_mark,
    timeLimitMinutes: row.time_limit_minutes,
    isCurrent: row.is_current,
    blueprint: parseBlueprint(row.blueprint),
  }));
}

/** The questions learners may be asked: published ones only. */
export async function loadQuestionPool(db: Db, countryCode: string): Promise<QuizQuestion[]> {
  const { rows } = await db.query<{
    id: string;
    topic_id: string;
    topic_slug: string;
    difficulty: number;
    type: QuizQuestion['type'];
    correct_answer: { keys: string[] };
    region_code: string | null;
    version: number;
  }>(
    `select q.id, q.topic_id, t.slug as topic_slug, q.difficulty, q.type, q.correct_answer,
            q.region_code, q.version
     from public.questions q
     join public.topics t on t.id = q.topic_id
     where q.country_code = $1 and q.status = 'published'`,
    [countryCode],
  );
  return rows.map((row) => ({
    id: row.id,
    topicId: row.topic_id,
    topicSlug: row.topic_slug,
    difficulty: row.difficulty,
    type: row.type,
    correctKeys: row.correct_answer.keys,
    regionCode: row.region_code,
    version: row.version,
  }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function problemWith(answer: QueuedAnswer): string | null {
  if (!UUID.test(answer.clientEventId)) return 'clientEventId must be a UUID.';
  if (!UUID.test(answer.attemptId) || !UUID.test(answer.questionId))
    return 'Unknown attempt or question.';
  if (!Number.isInteger(answer.questionVersion) || answer.questionVersion < 1)
    return 'Invalid question version.';
  if (!Number.isInteger(answer.timeMs) || answer.timeMs < 0) return 'Invalid answer time.';
  if (Number.isNaN(Date.parse(answer.answeredAt))) return 'Invalid answer timestamp.';
  return null;
}

/**
 * Stores answers from a client's offline queue. Safe to call again with the
 * same answers: one already stored counts as accepted. An answer that can
 * never be stored (not the learner's attempt, unknown question, malformed) is
 * refused permanently so the client stops resending it.
 */
export async function recordAnswers(
  db: Db,
  userId: string,
  answers: readonly QueuedAnswer[],
): Promise<SyncOutcome> {
  const outcome: SyncOutcome = { accepted: [], rejected: [] };
  for (const answer of answers) {
    const problem = problemWith(answer);
    if (problem) {
      outcome.rejected.push({
        clientEventId: answer.clientEventId,
        reason: problem,
        permanent: true,
      });
      continue;
    }
    const { rowCount } = await db.query(
      `insert into public.answer_events
         (user_id, attempt_id, question_id, question_version, selected_answer, correct, time_ms,
          created_at, client_event_id)
       select $1, a.id, q.id, $4, $5, $6, $7, $8, $9
       from public.attempts a, public.questions q
       where a.id = $2 and a.user_id = $1 and q.id = $3
       on conflict (user_id, client_event_id) where client_event_id is not null do nothing`,
      [
        userId,
        answer.attemptId,
        answer.questionId,
        answer.questionVersion,
        JSON.stringify({ keys: answer.selectedKeys }),
        answer.correct,
        answer.timeMs,
        answer.answeredAt,
        answer.clientEventId,
      ],
    );
    if (rowCount) {
      outcome.accepted.push(answer.clientEventId);
      continue;
    }
    // Nothing inserted: either it was stored before, or it can never be.
    const existing = await db.query(
      'select 1 from public.answer_events where user_id = $1 and client_event_id = $2',
      [userId, answer.clientEventId],
    );
    if (existing.rowCount) outcome.accepted.push(answer.clientEventId);
    else {
      outcome.rejected.push({
        clientEventId: answer.clientEventId,
        reason: 'Unknown attempt or question.',
        permanent: true,
      });
    }
  }
  return outcome;
}
