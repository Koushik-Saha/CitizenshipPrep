import type { Db } from './db';
import { ReviewError } from './review';

// The reviewers' side of learners' reports (public.content_flags): the queue
// of open ones, each with the question it is about, and closing one.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FlagReason = 'outdated' | 'incorrect' | 'unclear' | 'translation' | 'typo' | 'other';

export interface OpenFlag {
  id: string;
  reason: FlagReason;
  /** What the learner added in their own words. */
  details: string | null;
  /** The language they were reading in, when the app said. */
  locale: string | null;
  reportedAt: string;
  reporterId: string;
  /** How many open reports this question has, this one included. */
  reportsOnQuestion: number;
  question: {
    id: string;
    countryCode: string;
    status: string;
    topic: string;
    /** In the language it was written in. */
    locale: string;
    text: string;
    options: { key: string; text: string }[];
    correctKeys: string[];
    explanation: string | null;
    sourceUrl: string | null;
  };
}

export const FLAGS_PAGE_SIZE = 25;

/** How many reports are waiting for a reviewer. */
export async function countOpenFlags(db: Db): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `select count(*) as n from public.content_flags where status = 'open'`,
  );
  return Number(rows[0]!.n);
}

/**
 * Open reports, oldest first: the longest-waiting learner is answered first.
 * Each comes with its question as it was written, the answer marked.
 */
export async function listOpenFlags(
  db: Db,
  filters: { countryCode?: string | null; questionId?: string | null } = {},
  limit = FLAGS_PAGE_SIZE,
): Promise<OpenFlag[]> {
  const questionId =
    filters.questionId && UUID.test(filters.questionId) ? filters.questionId : null;
  const { rows } = await db.query<{
    id: string;
    reason: FlagReason;
    details: string | null;
    locale: string | null;
    created_at: Date;
    user_id: string;
    reports: string;
    question_id: string;
    country_code: string;
    status: string;
    topic: string;
    wording_locale: string;
    text: string;
    options: { key: string; text: string }[];
    correct_answer: { keys?: string[] };
    explanation: string | null;
    source_url: string | null;
  }>(
    `select f.id, f.reason, f.details, f.locale, f.created_at, f.user_id,
            (select count(*) from public.content_flags o
             where o.question_id = f.question_id and o.status = 'open') as reports,
            q.id as question_id, q.country_code, q.status, topic.name as topic,
            wording.locale as wording_locale, wording.text, wording.options, wording.explanation,
            q.correct_answer, q.source_url
     from public.content_flags f
     join public.questions q on q.id = f.question_id
     join public.topics topic on topic.id = q.topic_id
     join lateral (
       select t.text, t.locale, t.options, t.explanation from public.question_translations t
       where t.question_id = q.id
       order by (t.translated_from is null) desc, t.created_at
       limit 1
     ) wording on true
     where f.status = 'open'
       and ($1::text is null or q.country_code = $1)
       and ($2::uuid is null or q.id = $2)
     order by f.created_at, f.id
     limit $3`,
    [filters.countryCode || null, questionId, Math.min(Math.max(limit, 1), 100)],
  );
  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    details: row.details,
    locale: row.locale,
    reportedAt: row.created_at.toISOString(),
    reporterId: row.user_id,
    reportsOnQuestion: Number(row.reports),
    question: {
      id: row.question_id,
      countryCode: row.country_code,
      status: row.status,
      topic: row.topic,
      locale: row.wording_locale,
      text: row.text,
      options: row.options,
      correctKeys: row.correct_answer.keys ?? [],
      explanation: row.explanation,
      sourceUrl: row.source_url,
    },
  }));
}

/** The question an open report is about, or null when the report is not open (or not a report). */
export async function questionOfOpenFlag(db: Db, flagId: string): Promise<string | null> {
  if (!UUID.test(flagId)) return null;
  const { rows } = await db.query<{ question_id: string }>(
    `select question_id from public.content_flags where id = $1 and status = 'open'`,
    [flagId],
  );
  return rows[0]?.question_id ?? null;
}

/** How a report is closed: something was fixed, or there was nothing to fix. */
export type FlagOutcome = 'resolved' | 'dismissed';

/**
 * Closes an open report and says who did. Returns the question it was about.
 * A report that is not open (someone else got there first) is a ReviewError,
 * so the page can say so.
 */
export async function closeFlag(
  db: Db,
  flagId: string,
  reviewerId: string,
  outcome: FlagOutcome,
  note = '',
): Promise<{ questionId: string }> {
  if (!UUID.test(flagId)) throw new ReviewError('That report does not exist.');
  const staff = await db.query('select 1 from public.user_roles where user_id = $1', [reviewerId]);
  if (!staff.rowCount) throw new ReviewError('Only reviewers and admins can close reports.');
  const { rows } = await db.query<{ question_id: string }>(
    `update public.content_flags
     set status = $3, resolved_by = $2, resolution_note = nullif($4, '')
     where id = $1 and status = 'open'
     returning question_id`,
    [flagId, reviewerId, outcome, note.trim().slice(0, 2000)],
  );
  if (!rows[0]) throw new ReviewError('That report has already been closed.');
  return { questionId: rows[0].question_id };
}

/**
 * Closes every open report on a question at once, as fixed: for when the
 * question has been corrected or withdrawn, which answers all of them.
 * Returns how many were closed.
 */
export async function closeFlagsOnQuestion(
  db: Db,
  questionId: string,
  reviewerId: string,
  note = '',
): Promise<number> {
  const closed = await db.query(
    `update public.content_flags
     set status = 'resolved', resolved_by = $2, resolution_note = nullif($3, '')
     where question_id = $1 and status = 'open'`,
    [questionId, reviewerId, note.trim().slice(0, 2000)],
  );
  return closed.rowCount ?? 0;
}
