import { latestDate } from '@oathly/core';
import type pg from 'pg';

import type {
  CountryFacts,
  ExamDetails,
  ExamFacts,
  GuideQuestion,
  GuideWording,
  TestGuide,
  TestPages,
  TopicGuide,
  TopicSummary,
} from '../countries';

type Db = Pick<pg.Pool, 'query'>;

/** How many sample questions a public page shows. */
export const SAMPLE_QUESTIONS = 10;

const isoDate = (value: Date | string | null) =>
  value === null ? null : new Date(value).toISOString();

/**
 * Every country with a citizenship exam, with its current exam formats and
 * how many published questions it has. Public data: used to build the
 * landing page, so it reads nothing about any learner.
 */
export async function listCountryFacts(db: Db, isoCode?: string): Promise<CountryFacts[]> {
  const { rows } = await db.query<{
    iso_code: string;
    slug: string;
    name: string;
    exam_languages: string[];
    latitude: string | null;
    longitude: string | null;
    exams: (Omit<ExamFacts, 'lastVerifiedAt'> & { lastVerifiedAt: string | null })[] | null;
    published_questions: string;
  }>(
    `select c.iso_code, c.slug, c.name, c.exam_languages, c.latitude, c.longitude,
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
    slug: row.slug,
    name: row.name,
    examLanguages: row.exam_languages,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    exams: (row.exams ?? []).map((exam) => ({
      ...exam,
      lastVerifiedAt: isoDate(exam.lastVerifiedAt),
    })),
    publishedQuestions: Number(row.published_questions),
  }));
}

interface CountryRow {
  iso_code: string;
  slug: string;
  name: string;
  exam_languages: string[];
}

async function findCountry(db: Db, slug: string): Promise<CountryRow | null> {
  const { rows } = await db.query<CountryRow>(
    `select iso_code, slug, name, exam_languages
     from public.countries where slug = $1 and has_exam`,
    [slug],
  );
  return rows[0] ?? null;
}

/** A country's current exam formats in full, written test first. */
async function listExams(db: Db, isoCode: string): Promise<ExamDetails[]> {
  const { rows } = await db.query<{
    name: string;
    format_type: ExamFacts['formatType'];
    question_count: number | null;
    pass_mark: number | null;
    time_limit_minutes: number | null;
    question_pool_size: number | null;
    notes: string | null;
    source_url: string;
    last_verified_at: Date | null;
  }>(
    `select name, format_type, question_count, pass_mark, time_limit_minutes,
            question_pool_size, notes, source_url, last_verified_at
     from public.exam_formats
     where country_code = $1 and is_current
     order by format_type <> 'written', slug`,
    [isoCode],
  );
  return rows.map((row) => ({
    name: row.name,
    formatType: row.format_type,
    questionCount: row.question_count,
    passMark: row.pass_mark,
    timeLimitMinutes: row.time_limit_minutes,
    questionPoolSize: row.question_pool_size,
    notes: row.notes,
    sourceUrl: row.source_url,
    lastVerifiedAt: isoDate(row.last_verified_at),
  }));
}

interface TopicRow extends TopicSummary {
  lastVerifiedAt: string | null;
}

async function listTopics(db: Db, isoCode: string): Promise<TopicRow[]> {
  const { rows } = await db.query<{
    slug: string;
    name: string;
    published: string;
    last_verified_at: Date | null;
  }>(
    `select t.slug, t.name, count(q.id) as published, max(q.last_verified_at) as last_verified_at
     from public.topics t
     left join public.questions q on q.topic_id = t.id and q.status = 'published'
     where t.country_code = $1
     group by t.id
     order by t.sort_order, t.name`,
    [isoCode],
  );
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    publishedQuestions: Number(row.published),
    lastVerifiedAt: isoDate(row.last_verified_at),
  }));
}

const summary = ({ slug, name, publishedQuestions }: TopicRow): TopicSummary => ({
  slug,
  name,
  publishedQuestions,
});

/**
 * A sample of a country's published questions, or of one topic's. Explained
 * questions come first, then easier ones; across a whole country the topics
 * take turns, so the sample shows the breadth of the test.
 *
 * Each is worded in `locale` where a reviewed translation exists, and
 * otherwise as the exam words it. Never a draft or an unreviewed translation.
 */
async function sampleQuestions(
  db: Db,
  isoCode: string,
  locale: string,
  limit: number,
  topicSlug: string | null,
): Promise<GuideQuestion[]> {
  const { rows } = await db.query<{
    id: string;
    topic_slug: string;
    topic_name: string;
    shown: GuideWording & { explanation: string | null };
    original: GuideWording;
    correct_answer: { keys: string[] };
    source_url: string;
    source_quote: string | null;
    last_verified_at: Date;
  }>(
    `with ranked as (
       select q.id, q.topic_id, q.correct_answer, q.source_url, q.source_quote, q.last_verified_at,
              t.slug as topic_slug, t.name as topic_name, t.sort_order,
              json_build_object('locale', o.locale, 'text', o.text, 'options', o.options) as original,
              row_number() over (
                partition by q.topic_id
                order by (o.explanation is null), q.difficulty, q.created_at, q.id
              ) as turn
       from public.questions q
       join public.topics t on t.id = q.topic_id
       join public.question_translations o
         on o.question_id = q.id and o.translated_from is null and o.status = 'approved'
       where q.country_code = $1 and q.status = 'published'
         and ($4::text is null or t.slug = $4)
     )
     select r.id, r.topic_slug, r.topic_name, r.original, r.correct_answer, r.source_url,
            r.source_quote, r.last_verified_at,
            (select json_build_object('locale', tr.locale, 'text', tr.text,
                                      'options', tr.options, 'explanation', tr.explanation)
             from public.question_translations tr
             where tr.question_id = r.id and tr.status = 'approved'
               and (tr.locale = $2 or tr.translated_from is null)
             order by (tr.locale = $2) desc
             limit 1) as shown
     from ranked r
     order by r.turn, r.sort_order, r.topic_name, r.id
     limit $3`,
    [isoCode, locale, limit, topicSlug],
  );
  return rows.map((row) => ({
    id: row.id,
    topic: { slug: row.topic_slug, name: row.topic_name },
    locale: row.shown.locale,
    text: row.shown.text,
    options: row.shown.options,
    correctKeys: row.correct_answer.keys,
    explanation: row.shown.explanation,
    original: row.shown.locale === row.original.locale ? null : row.original,
    sourceUrl: row.source_url,
    sourceQuote: row.source_quote,
    lastVerifiedAt: row.last_verified_at.toISOString(),
  }));
}

/**
 * The public page for one country's test: the exam's facts, its topics and a
 * sample of questions in the reader's language. Null if Oathly does not cover
 * the country.
 */
export async function getTestGuide(
  db: Db,
  slug: string,
  locale: string,
  limit = SAMPLE_QUESTIONS,
): Promise<TestGuide | null> {
  const country = await findCountry(db, slug);
  if (!country) return null;
  const [exams, topics, questions] = await Promise.all([
    listExams(db, country.iso_code),
    listTopics(db, country.iso_code),
    sampleQuestions(db, country.iso_code, locale, limit, null),
  ]);
  return {
    isoCode: country.iso_code,
    slug: country.slug,
    name: country.name,
    examLanguages: country.exam_languages,
    exams,
    topics: topics.map(summary),
    questions,
    publishedQuestions: topics.reduce((sum, topic) => sum + topic.publishedQuestions, 0),
    lastVerifiedAt: latestDate([
      ...exams.map((exam) => exam.lastVerifiedAt),
      ...topics.map((topic) => topic.lastVerifiedAt),
    ]),
  };
}

/**
 * The public page for one topic of a country's test. Null when there is no
 * such topic or none of its questions is published yet: a page goes up with
 * its first verified question.
 */
export async function getTopicGuide(
  db: Db,
  slug: string,
  topicSlug: string,
  locale: string,
  limit = SAMPLE_QUESTIONS,
): Promise<TopicGuide | null> {
  const country = await findCountry(db, slug);
  if (!country) return null;
  const topics = (await listTopics(db, country.iso_code)).filter(
    (topic) => topic.publishedQuestions > 0,
  );
  const topic = topics.find((candidate) => candidate.slug === topicSlug);
  if (!topic) return null;
  const [exams, questions] = await Promise.all([
    listExams(db, country.iso_code),
    sampleQuestions(db, country.iso_code, locale, limit, topicSlug),
  ]);
  return {
    country: {
      isoCode: country.iso_code,
      slug: country.slug,
      name: country.name,
      examLanguages: country.exam_languages,
    },
    exams,
    topic: summary(topic),
    otherTopics: topics.filter((candidate) => candidate.slug !== topicSlug).map(summary),
    questions,
    lastVerifiedAt: topic.lastVerifiedAt,
  };
}

/**
 * Every public test page: one per country with an exam, and one per topic
 * that has a published question. For building the pages ahead of time, the
 * sitemap, and sending old addresses to new ones.
 */
export async function listTestPages(db: Db): Promise<TestPages[]> {
  const { rows } = await db.query<{
    iso_code: string;
    slug: string;
    exams_verified_at: Date | null;
    topics: { slug: string; lastVerifiedAt: string }[] | null;
  }>(
    `select c.iso_code, c.slug,
            (select max(f.last_verified_at) from public.exam_formats f
             where f.country_code = c.iso_code and f.is_current) as exams_verified_at,
            (select json_agg(json_build_object('slug', p.slug, 'lastVerifiedAt', p.last_verified_at)
                             order by p.sort_order, p.name)
             from (select t.slug, t.name, t.sort_order, max(q.last_verified_at) as last_verified_at
                   from public.topics t
                   join public.questions q on q.topic_id = t.id and q.status = 'published'
                   where t.country_code = c.iso_code
                   group by t.id) p) as topics
     from public.countries c
     where c.has_exam
     order by c.slug`,
  );
  return rows.map((row) => {
    const topics = (row.topics ?? []).map((topic) => ({
      slug: topic.slug,
      lastVerifiedAt: isoDate(topic.lastVerifiedAt),
    }));
    return {
      isoCode: row.iso_code,
      slug: row.slug,
      lastVerifiedAt: latestDate([
        isoDate(row.exams_verified_at),
        ...topics.map((topic) => topic.lastVerifiedAt),
      ]),
      topics,
    };
  });
}
