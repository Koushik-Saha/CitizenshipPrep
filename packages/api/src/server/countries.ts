import type pg from 'pg';

import type { CountryFacts, ExamFacts } from '../countries';

type Db = Pick<pg.Pool, 'query'>;

/**
 * Every country with a citizenship exam, with its current exam formats and
 * how many published questions it has. Public data: used to build the
 * landing page, so it reads nothing about any learner.
 */
export async function listCountryFacts(db: Db): Promise<CountryFacts[]> {
  const { rows } = await db.query<{
    iso_code: string;
    name: string;
    exam_languages: string[];
    latitude: string | null;
    longitude: string | null;
    exams: (Omit<ExamFacts, 'lastVerifiedAt'> & { lastVerifiedAt: string | null })[] | null;
    published_questions: string;
  }>(
    `select c.iso_code, c.name, c.exam_languages, c.latitude, c.longitude,
            (select json_agg(json_build_object(
                      'name', f.name,
                      'formatType', f.format_type,
                      'questionCount', f.question_count,
                      'passMark', f.pass_mark,
                      'timeLimitMinutes', f.time_limit_minutes,
                      'sourceUrl', f.source_url,
                      'lastVerifiedAt', f.last_verified_at)
                    order by f.format_type <> 'written', f.slug)
             from public.exam_formats f
             where f.country_code = c.iso_code and f.is_current) as exams,
            (select count(*) from public.questions q
             where q.country_code = c.iso_code and q.status = 'published') as published_questions
     from public.countries c
     where c.has_exam
     order by c.name`,
  );
  return rows.map((row) => ({
    isoCode: row.iso_code,
    name: row.name,
    examLanguages: row.exam_languages,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    exams: (row.exams ?? []).map((exam) => ({
      ...exam,
      lastVerifiedAt: exam.lastVerifiedAt ? new Date(exam.lastVerifiedAt).toISOString() : null,
    })),
    publishedQuestions: Number(row.published_questions),
  }));
}
