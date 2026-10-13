import type { QuestionReport } from '@oathly/core';
import type pg from 'pg';

// A learner reporting a problem with a question. Reports go to
// public.content_flags, where the reviewers' queue (/admin/flags) reads them.

type Db = Pick<pg.Pool, 'query'>;

/**
 * Saves a learner's report. "missing" when the question is not one they can
 * see: not published, or for a country they do not study. "already" when
 * they have an open report of the same kind for it, which is left as it is.
 */
export async function reportQuestion(
  db: Db,
  userId: string,
  questionId: string,
  report: QuestionReport,
): Promise<'saved' | 'already' | 'missing'> {
  const seen = await db.query(
    `select 1 from public.questions q
     join public.user_countries uc on uc.country_code = q.country_code and uc.user_id = $2
     where q.id = $1 and q.status = 'published'`,
    [questionId, userId],
  );
  if (!seen.rowCount) return 'missing';
  const saved = await db.query(
    `insert into public.content_flags (question_id, user_id, locale, reason, details)
     values ($1, $2, $3, $4, $5)
     on conflict (question_id, user_id, reason) where status = 'open' do nothing`,
    [questionId, userId, report.locale, report.reason, report.details],
  );
  return saved.rowCount ? 'saved' : 'already';
}
