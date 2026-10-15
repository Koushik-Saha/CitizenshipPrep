import type { Db } from './db';

// Exam formats as reviewers check them. A format's facts (how many questions,
// the pass mark, the time, the rules) are entered from the official page but
// shown to learners as "details being checked" until a person has read that
// page and confirmed them. That confirmation is made here, never by a script.

export interface ExamFormatForReview {
  id: string;
  countryCode: string;
  countryName: string;
  countrySlug: string;
  name: string;
  formatType: string;
  questionCount: number | null;
  passMark: number | null;
  timeLimitMinutes: number | null;
  questionPoolSize: number | null;
  notes: string | null;
  sourceUrl: string;
  blueprint: unknown;
  /** ISO 8601; null until a reviewer has checked the facts. */
  lastVerifiedAt: string | null;
  verifiedByName: string | null;
}

/** Every current exam format, the ones not yet checked first. */
export async function listExamFormatsForReview(db: Db): Promise<ExamFormatForReview[]> {
  const { rows } = await db.query<{
    id: string;
    country_code: string;
    country_name: string;
    country_slug: string;
    name: string;
    format_type: string;
    question_count: number | null;
    pass_mark: number | null;
    time_limit_minutes: number | null;
    question_pool_size: number | null;
    notes: string | null;
    source_url: string;
    blueprint: unknown;
    last_verified_at: Date | null;
    verified_by_name: string | null;
  }>(
    `select f.id, f.country_code, c.name as country_name, c.slug as country_slug, f.name,
            f.format_type, f.question_count, f.pass_mark, f.time_limit_minutes,
            f.question_pool_size, f.notes, f.source_url, f.blueprint, f.last_verified_at,
            coalesce(p.display_name, f.verified_by) as verified_by_name
     from public.exam_formats f
     join public.countries c on c.iso_code = f.country_code
     left join public.profiles p on p.id = f.verified_by
     where f.is_current
     order by f.last_verified_at is not null, c.name, f.slug`,
  );
  return rows.map((row) => ({
    id: row.id,
    countryCode: row.country_code,
    countryName: row.country_name,
    countrySlug: row.country_slug,
    name: row.name,
    formatType: row.format_type,
    questionCount: row.question_count,
    passMark: row.pass_mark,
    timeLimitMinutes: row.time_limit_minutes,
    questionPoolSize: row.question_pool_size,
    notes: row.notes,
    sourceUrl: row.source_url,
    blueprint: row.blueprint,
    lastVerifiedAt: row.last_verified_at?.toISOString() ?? null,
    verifiedByName: row.verified_by_name,
  }));
}

/**
 * A reviewer confirms an exam format's facts match its official source, as
 * of now. Returns the country's slug (its pages show the date), or null when
 * there is no such current format.
 */
export async function markExamFormatChecked(
  db: Db,
  formatId: string,
  reviewerId: string,
  now: Date = new Date(),
): Promise<{ countryCode: string; countrySlug: string; name: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(formatId)) return null;
  const { rows } = await db.query<{ country_code: string; slug: string; name: string }>(
    `update public.exam_formats f
     set last_verified_at = $3, verified_by = $2
     from public.countries c
     where f.id = $1 and f.is_current and c.iso_code = f.country_code
     returning f.country_code, c.slug, f.name`,
    [formatId, reviewerId, now],
  );
  const row = rows[0];
  return row ? { countryCode: row.country_code, countrySlug: row.slug, name: row.name } : null;
}
