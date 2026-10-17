import { questionProblems, type QuestionProblem } from '@oathly/core';
import type { QuestionType } from '@oathly/core';

import type { Db } from './db';

// The bank audit: every question learners can be shown, in every language
// they can be shown it in (its approved wordings), checked for faults that
// make it unplayable (see questionProblems in packages/core). It only
// reports; a flagged question is fixed in the review queue, or pulled there,
// by a reviewer.

export interface AuditedQuestion {
  id: string;
  countryCode: string;
  status: string;
  officialNumber: string | null;
  /** The question's words in its first language, to find it by. */
  text: string;
  problems: QuestionProblem[];
}

export interface BankAudit {
  /** Questions checked, by country. */
  checked: Record<string, number>;
  /** Only the questions with at least one problem. */
  flagged: AuditedQuestion[];
}

interface Row {
  id: string;
  country_code: string;
  status: string;
  official_number: string | null;
  type: QuestionType;
  correct_answer: { keys?: unknown };
  source_url: string | null;
  wordings: { locale: string; text: string; options: unknown; explanation: string | null }[] | null;
}

const asOptions = (value: unknown): { key: string; text: string }[] =>
  Array.isArray(value)
    ? value.map((option: { key?: unknown; text?: unknown }) => ({
        key: String(option?.key ?? ''),
        text: typeof option?.text === 'string' ? option.text : '',
      }))
    : [];

/**
 * Checks the published questions (or those in `statuses`), of one country
 * or all. Each wording is checked on its own, so a fault is reported against
 * the language it is in; the original wording comes first. A published
 * question is checked in its approved wordings, the ones learners see; any
 * other in all of them.
 */
export async function auditQuestions(
  db: Db,
  options: { countryCode?: string; statuses?: readonly string[] } = {},
): Promise<BankAudit> {
  const { rows } = await db.query<Row>(
    `select q.id, q.country_code, q.status::text as status, q.official_number, q.type::text as type,
            q.correct_answer, q.source_url,
            (select jsonb_agg(jsonb_build_object('locale', t.locale, 'text', t.text,
                       'options', t.options, 'explanation', t.explanation)
                     order by t.translated_from is not null, t.locale)
               from public.question_translations t
              where t.question_id = q.id
                and (t.status = 'approved' or q.status <> 'published')) as wordings
       from public.questions q
      where q.status::text = any($1::text[])
        and ($2::text is null or q.country_code = $2)
      order by q.country_code, q.official_number nulls last, q.created_at, q.id`,
    [options.statuses ?? ['published'], options.countryCode ?? null],
  );

  const checked: Record<string, number> = {};
  const flagged: AuditedQuestion[] = [];
  for (const row of rows) {
    checked[row.country_code] = (checked[row.country_code] ?? 0) + 1;
    const wordings = row.wordings ?? [];
    const keys = row.correct_answer?.keys;
    const problems = questionProblems({
      type: row.type,
      correctKeys: Array.isArray(keys) ? keys.map(String) : [],
      sourceUrl: row.source_url,
      wordings: wordings.map((wording) => ({
        locale: wording.locale,
        options: asOptions(wording.options),
        explanation: wording.explanation,
      })),
    });
    if (problems.length === 0) continue;
    flagged.push({
      id: row.id,
      countryCode: row.country_code,
      status: row.status,
      officialNumber: row.official_number,
      text: wordings[0]?.text ?? '',
      problems,
    });
  }
  return { checked, flagged };
}
