import type pg from 'pg';

import type {
  CountryFacts,
  CountryGuide,
  ExamFacts,
  GuideQuestion,
  TopicGuide,
  TopicSummary,
} from '../countries';

type Db = Pick<pg.Pool, 'query'>;

/**
 * Every country with a citizenship exam, with its current exam formats and
 * how many published questions it has. Public data: used to build the
 * landing page, so it reads nothing about any learner.
 */
export async function listCountryFacts(db: Db, isoCode?: string): Promise<CountryFacts[]> {
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
     where c.has_exam and ($1::text is null or c.iso_code = $1)
     order by c.name`,
    [isoCode ?? null],
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

async function listTopics(db: Db, isoCode: string): Promise<TopicSummary[]> {
  const { rows } = await db.query<{ slug: string; name: string; published: string }>(
    `select t.slug, t.name,
            (select count(*) from public.questions q
             where q.topic_id = t.id and q.status = 'published') as published
     from public.topics t
     where t.country_code = $1
     order by t.sort_order, t.name`,
    [isoCode],
  );
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    publishedQuestions: Number(row.published),
  }));
}

/** The public page for one country's exam, or null if Oathly does not cover it. */
export async function getCountryGuide(db: Db, isoCode: string): Promise<CountryGuide | null> {
  const [facts] = await listCountryFacts(db, isoCode.toUpperCase());
  if (!facts) return null;
  return { ...facts, topics: await listTopics(db, facts.isoCode) };
}

/**
 * The public page for one topic: its published questions in the exam's own
 * language (never a draft or an unreviewed translation), up to `limit`.
 */
export async function getTopicGuide(
  db: Db,
  isoCode: string,
  slug: string,
  limit = 12,
): Promise<TopicGuide | null> {
  const code = isoCode.toUpperCase();
  const country = await db.query<{ name: string }>(
    'select name from public.countries where iso_code = $1 and has_exam',
    [code],
  );
  if (!country.rows[0]) return null;
  const topics = await listTopics(db, code);
  const topic = topics.find((candidate) => candidate.slug === slug);
  if (!topic) return null;

  const { rows } = await db.query<{
    id: string;
    locale: string;
    text: string;
    options: { key: string; text: string }[];
    correct_answer: { keys: string[] };
    explanation: string | null;
    source_url: string;
    source_quote: string | null;
    last_verified_at: Date;
  }>(
    `select q.id, tr.locale, tr.text, tr.options, q.correct_answer, tr.explanation,
            q.source_url, q.source_quote, q.last_verified_at
     from public.questions q
     join public.topics t on t.id = q.topic_id
     join public.question_translations tr
       on tr.question_id = q.id and tr.translated_from is null and tr.status = 'approved'
     where t.country_code = $1 and t.slug = $2 and q.status = 'published'
     order by q.difficulty, q.created_at, q.id
     limit $3`,
    [code, slug, limit],
  );
  const questions: GuideQuestion[] = rows.map((row) => ({
    id: row.id,
    locale: row.locale,
    text: row.text,
    options: row.options,
    correctKeys: row.correct_answer.keys,
    explanation: row.explanation,
    sourceUrl: row.source_url,
    sourceQuote: row.source_quote,
    lastVerifiedAt: row.last_verified_at.toISOString(),
  }));
  return {
    countryCode: code,
    countryName: country.rows[0].name,
    topic,
    otherTopics: topics.filter((candidate) => candidate.slug !== slug),
    questions,
  };
}

/** Every country and topic with a public page, for building them ahead of time. */
export async function listGuidePaths(db: Db): Promise<{ isoCode: string; topics: string[] }[]> {
  const { rows } = await db.query<{ iso_code: string; topics: string[] }>(
    `select c.iso_code,
            coalesce(array_agg(t.slug order by t.sort_order) filter (where t.id is not null), '{}') as topics
     from public.countries c
     left join public.topics t on t.country_code = c.iso_code
     where c.has_exam
     group by c.iso_code
     order by c.iso_code`,
  );
  return rows.map((row) => ({ isoCode: row.iso_code, topics: row.topics }));
}
