import type pg from 'pg';

import { withTransaction, type Db } from './db';
import type { QuestionOption } from './schemas';

// Steps 4 and 5 of the pipeline: what a reviewer can see and decide. The admin
// UI calls these and only renders; every rule about what a decision means
// lives here.

export class ReviewError extends Error {
  override readonly name = 'ReviewError';
}

export interface Reviewer {
  id: string;
  displayName: string;
}

/**
 * Creates the reviewer's profile if needed and makes sure they hold a staff
 * role. Used for the interim admin sign-in, where the account is defined by
 * environment variables rather than by an auth provider.
 */
export async function ensureReviewer(
  db: Db,
  reviewer: Reviewer,
  role: 'reviewer' | 'admin',
): Promise<void> {
  await db.query(
    `insert into public.profiles (id, display_name) values ($1, $2)
     on conflict (id) do nothing`,
    [reviewer.id, reviewer.displayName.slice(0, 60)],
  );
  await db.query(
    `insert into public.user_roles (user_id, role) values ($1, $2)
     on conflict (user_id) do nothing`,
    [reviewer.id, role],
  );
}

async function assertStaff(db: Db, reviewerId: string): Promise<void> {
  const { rowCount } = await db.query('select 1 from public.user_roles where user_id = $1', [
    reviewerId,
  ]);
  if (!rowCount) throw new ReviewError('Only reviewers and admins can review content.');
}

// --- Queue ---------------------------------------------------------------------

export interface QueueCounts {
  /** Drafts and questions in review, waiting for a decision. */
  questions: number;
  /** Draft translations of published questions. */
  translations: number;
  /** Questions whose cited passage is no longer in the source. */
  sourceChanged: number;
  published: number;
}

export async function getQueueCounts(db: Db, countryCode?: string): Promise<QueueCounts> {
  const { rows } = await db.query<{
    questions: string;
    translations: string;
    source_changed: string;
    published: string;
  }>(
    `select
       (select count(*) from public.questions q
          where q.status in ('draft', 'in_review')
            and ($1::text is null or q.country_code = $1)) as questions,
       (select count(*) from public.question_translations t
          join public.questions q on q.id = t.question_id
          where t.status = 'draft' and t.translated_from is not null and q.status = 'published'
            and ($1::text is null or q.country_code = $1)) as translations,
       (select count(*) from public.questions q
          where q.source_changed_at is not null and q.status in ('draft', 'in_review', 'published')
            and ($1::text is null or q.country_code = $1)) as source_changed,
       (select count(*) from public.questions q
          where q.status = 'published'
            and ($1::text is null or q.country_code = $1)) as published`,
    [countryCode ?? null],
  );
  const row = rows[0]!;
  return {
    questions: Number(row.questions),
    translations: Number(row.translations),
    sourceChanged: Number(row.source_changed),
    published: Number(row.published),
  };
}

/** How much of one topic has been drafted, published and translated. */
export interface TopicCoverage {
  slug: string;
  name: string;
  /** Drafts and questions in review: waiting for a reviewer. */
  waiting: number;
  published: number;
  /** Languages the topic's questions have any translation in, drafted or approved. */
  translatedInto: string[];
}

/**
 * A country's questions by topic, in the topics' own order: what a reviewer
 * compares with the official guide's contents to see what is thin or missing.
 * Rejected and retired questions are not counted.
 */
export async function getTopicCoverage(db: Db, countryCode: string): Promise<TopicCoverage[]> {
  const { rows } = await db.query<{
    slug: string;
    name: string;
    waiting: string;
    published: string;
    locales: string[] | null;
  }>(
    `select t.slug, t.name,
            count(q.id) filter (where q.status in ('draft', 'in_review')) as waiting,
            count(q.id) filter (where q.status = 'published') as published,
            (select array_agg(distinct tr.locale order by tr.locale)
             from public.question_translations tr
             join public.questions tq on tq.id = tr.question_id
             where tq.topic_id = t.id and tr.translated_from is not null
               and tq.status in ('draft', 'in_review', 'published')) as locales
     from public.topics t
     left join public.questions q on q.topic_id = t.id
     where t.country_code = $1
     group by t.id
     order by t.sort_order, t.name`,
    [countryCode],
  );
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    waiting: Number(row.waiting),
    published: Number(row.published),
    translatedInto: row.locales ?? [],
  }));
}

export interface QueueQuestion {
  id: string;
  countryCode: string;
  status: string;
  topic: string;
  difficulty: number;
  text: string;
  locale: string;
  hasSource: boolean;
  isPossibleDuplicate: boolean;
  sourceChanged: boolean;
  createdAt: Date;
  type: string;
  /** "official": the government's own wording. "original": ours. Null: drafted by the pipeline. */
  origin: 'official' | 'original' | null;
  officialNumber: string | null;
  /** Where in the source the answer is, for a question loaded from a file. */
  sourceLocator: string | null;
  needsFreshnessCheck: boolean;
}

export type QuestionQueue = 'pending' | 'source-changed';

/** Which flagged questions to show. */
export const queueFlags = ['duplicate', 'no-source', 'has-source', 'freshness'] as const;
export type QueueFlag = (typeof queueFlags)[number];

/** Where a question's wording comes from. "pipeline" is one drafted from a stored guide. */
export const queueOrigins = ['official', 'original', 'pipeline'] as const;
export type QueueOrigin = (typeof queueOrigins)[number];

/** Difficulty in the three bands targets are set in: 1-2, 3, 4-5. */
export const queueLevels = ['easy', 'medium', 'hard'] as const;
export type QueueLevel = (typeof queueLevels)[number];

export const queueTypes = [
  'multiple_choice',
  'multi_select',
  'true_false',
  'free_response',
] as const;
export type QueueType = (typeof queueTypes)[number];

/** The order of a queue. "number" follows the official catalogue's numbering. */
export const queueSorts = ['oldest', 'newest', 'number'] as const;
export type QueueSort = (typeof queueSorts)[number];

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 50;

/** One page of a queue, and how many there are in all. */
export interface QueuePage<T> {
  items: T[];
  total: number;
  /** The page shown, from 1. Asking beyond the last page gives the last. */
  page: number;
  pageSize: number;
  pages: number;
}

export interface Paging {
  page?: number;
  pageSize?: number;
}

/** A page request made safe: a whole number within range, a size from the list. */
function paging(request: Paging | undefined, total: number) {
  const pageSize = (PAGE_SIZES as readonly number[]).includes(request?.pageSize ?? NaN)
    ? request!.pageSize!
    : DEFAULT_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const asked = Number.isInteger(request?.page) ? request!.page! : 1;
  const page = Math.min(Math.max(1, asked), pages);
  return { page, pageSize, pages, offset: (page - 1) * pageSize };
}

/** Narrows a queue. Everything is optional; a string is a country, as it used to be. */
export interface QueueFilters {
  countryCode?: string;
  /** Words to find in the question's text. */
  search?: string;
  /** A topic's slug, within the country. */
  topic?: string;
  flag?: QueueFlag;
  origin?: QueueOrigin;
  level?: QueueLevel;
  type?: QueueType;
  sort?: QueueSort;
}

const asFilters = (filters: QueueFilters | string | undefined): QueueFilters =>
  typeof filters === 'string' ? { countryCode: filters } : (filters ?? {});

/** A search as a LIKE pattern: what was typed, found anywhere, taken literally. */
const likePattern = (search: string | undefined) => {
  const text = search?.trim();
  return text ? `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%` : null;
};

const QUESTION_QUEUE_FROM = `
     from public.questions q
     join public.topics topic on topic.id = q.topic_id
     join lateral (
       select t.text, t.locale from public.question_translations t
       where t.question_id = q.id
       order by (t.translated_from is null) desc, t.created_at
       limit 1
     ) wording on true
     where ($2::text is null or q.country_code = $2)
       and case $1
             when 'pending' then q.status in ('draft', 'in_review')
             else q.source_changed_at is not null and q.status in ('draft', 'in_review', 'published')
           end
       and ($3::text is null or wording.text ilike $3)
       and ($4::text is null or topic.slug = $4)
       and case $5::text
             when 'duplicate' then q.duplicate_of is not null
             when 'no-source' then q.source_passage_id is null and q.source_locator is null
             when 'has-source' then q.source_passage_id is not null or q.source_locator is not null
             when 'freshness' then q.needs_freshness_check
             else true
           end
       and case $6::text
             when 'official' then q.origin = 'official'
             when 'original' then q.origin = 'original'
             when 'pipeline' then q.origin is null
             else true
           end
       and case $7::text
             when 'easy' then q.difficulty <= 2
             when 'medium' then q.difficulty = 3
             when 'hard' then q.difficulty >= 4
             else true
           end
       and ($8::text is null or q.type::text = $8)`;

// Official numbers are "1" to "128": ordered as numbers, with anything else after them.
const QUESTION_QUEUE_ORDER: Record<QueueSort, string> = {
  oldest: 'q.country_code, q.created_at, q.id',
  newest: 'q.created_at desc, q.id',
  number: `q.country_code,
           case when q.official_number ~ '^[0-9]+$' then q.official_number::int end nulls last,
           q.official_number nulls last, q.created_at, q.id`,
};

/**
 * One page of a question queue, narrowed by the filters, and the number of
 * questions the filters leave in all.
 */
export async function pageQuestionQueue(
  db: Db,
  queue: QuestionQueue,
  filters?: QueueFilters | string,
  request?: Paging,
): Promise<QueuePage<QueueQuestion>> {
  const { countryCode, search, topic, flag, origin, level, type, sort } = asFilters(filters);
  const params = [
    queue,
    countryCode ?? null,
    likePattern(search),
    topic ?? null,
    flag ?? null,
    origin ?? null,
    level ?? null,
    type ?? null,
  ];
  const { rows: counted } = await db.query<{ total: number }>(
    `select count(*)::int as total ${QUESTION_QUEUE_FROM}`,
    params,
  );
  const total = counted[0]!.total;
  const { page, pageSize, pages, offset } = paging(request, total);
  const { rows } = await db.query<{
    id: string;
    country_code: string;
    status: string;
    topic: string;
    difficulty: number;
    text: string;
    locale: string;
    has_source: boolean;
    is_possible_duplicate: boolean;
    source_changed: boolean;
    created_at: Date;
    type: string;
    origin: 'official' | 'original' | null;
    official_number: string | null;
    source_locator: string | null;
    needs_freshness_check: boolean;
  }>(
    `select q.id, q.country_code, q.status::text, topic.name as topic, q.difficulty,
            wording.text, wording.locale,
            (q.source_passage_id is not null or q.source_locator is not null) as has_source,
            q.duplicate_of is not null as is_possible_duplicate,
            q.source_changed_at is not null as source_changed,
            q.created_at, q.type::text, q.origin, q.official_number, q.source_locator,
            q.needs_freshness_check
     ${QUESTION_QUEUE_FROM}
     order by ${QUESTION_QUEUE_ORDER[sort ?? 'oldest']}
     limit $9 offset $10`,
    [...params, pageSize, offset],
  );
  return {
    total,
    page,
    pageSize,
    pages,
    items: rows.map((row) => ({
      id: row.id,
      countryCode: row.country_code,
      status: row.status,
      topic: row.topic,
      difficulty: row.difficulty,
      text: row.text,
      locale: row.locale,
      hasSource: row.has_source,
      isPossibleDuplicate: row.is_possible_duplicate,
      sourceChanged: row.source_changed,
      createdAt: row.created_at,
      type: row.type,
      origin: row.origin,
      officialNumber: row.official_number,
      sourceLocator: row.source_locator,
      needsFreshnessCheck: row.needs_freshness_check,
    })),
  };
}

/** A queue's questions, up to the largest page: for callers that want a plain list. */
export async function listQuestionQueue(
  db: Db,
  queue: QuestionQueue,
  filters?: QueueFilters | string,
): Promise<QueueQuestion[]> {
  return (
    await pageQuestionQueue(db, queue, filters, { pageSize: PAGE_SIZES[PAGE_SIZES.length - 1] })
  ).items;
}

export interface QueueTranslation {
  questionId: string;
  countryCode: string;
  locale: string;
  translatedFrom: string;
  text: string;
  originalText: string;
}

const TRANSLATION_QUEUE_FROM = `
     from public.question_translations t
     join public.questions q on q.id = t.question_id
     join public.question_translations original
       on original.question_id = t.question_id and original.locale = t.translated_from
     where t.status = 'draft' and t.translated_from is not null and q.status = 'published'
       and ($1::text is null or q.country_code = $1)
       and ($2::text is null or t.text ilike $2 or original.text ilike $2)
       and ($3::text is null or t.locale = $3)`;

type TranslationFilters =
  (Pick<QueueFilters, 'countryCode' | 'search'> & { locale?: string }) | string;

/** One page of the draft translations of published questions, and how many there are in all. */
export async function pageTranslationQueue(
  db: Db,
  filters?: TranslationFilters,
  request?: Paging,
): Promise<QueuePage<QueueTranslation>> {
  const narrowed = typeof filters === 'string' ? { countryCode: filters } : (filters ?? {});
  const params = [
    narrowed.countryCode ?? null,
    likePattern(narrowed.search),
    narrowed.locale ?? null,
  ];
  const { rows: counted } = await db.query<{ total: number }>(
    `select count(*)::int as total ${TRANSLATION_QUEUE_FROM}`,
    params,
  );
  const total = counted[0]!.total;
  const { page, pageSize, pages, offset } = paging(request, total);
  const { rows } = await db.query<{
    question_id: string;
    country_code: string;
    locale: string;
    translated_from: string;
    text: string;
    original_text: string;
  }>(
    `select t.question_id, q.country_code, t.locale, t.translated_from, t.text,
            original.text as original_text
     ${TRANSLATION_QUEUE_FROM}
     order by q.country_code, t.locale, t.created_at, t.question_id
     limit $4 offset $5`,
    [...params, pageSize, offset],
  );
  return {
    total,
    page,
    pageSize,
    pages,
    items: rows.map((row) => ({
      questionId: row.question_id,
      countryCode: row.country_code,
      locale: row.locale,
      translatedFrom: row.translated_from,
      text: row.text,
      originalText: row.original_text,
    })),
  };
}

export async function listTranslationQueue(
  db: Db,
  filters?: TranslationFilters,
): Promise<QueueTranslation[]> {
  return (await pageTranslationQueue(db, filters, { pageSize: PAGE_SIZES[PAGE_SIZES.length - 1] }))
    .items;
}

/** A country's topics, for narrowing its queue. */
export async function listReviewTopics(
  db: Db,
  countryCode: string,
): Promise<{ slug: string; name: string }[]> {
  const { rows } = await db.query<{ slug: string; name: string }>(
    'select slug, name from public.topics where country_code = $1 order by sort_order, name',
    [countryCode],
  );
  return rows;
}

/** The languages that have translations waiting, for narrowing that queue. */
export async function listPendingTranslationLocales(db: Db): Promise<string[]> {
  const { rows } = await db.query<{ locale: string }>(
    `select distinct t.locale
     from public.question_translations t
     join public.questions q on q.id = t.question_id
     where t.status = 'draft' and t.translated_from is not null and q.status = 'published'
     order by t.locale`,
  );
  return rows.map((row) => row.locale);
}

export async function listReviewCountries(db: Db): Promise<{ isoCode: string; name: string }[]> {
  const { rows } = await db.query<{ iso_code: string; name: string }>(
    'select iso_code, name from public.countries order by name',
  );
  return rows.map((row) => ({ isoCode: row.iso_code, name: row.name }));
}

// --- One question ----------------------------------------------------------------

export interface Wording {
  locale: string;
  text: string;
  options: QuestionOption[];
  explanation: string | null;
  status: 'draft' | 'approved';
  translatedFrom: string | null;
}

export interface ReviewDecision {
  action: string;
  locale: string | null;
  reviewer: string | null;
  note: string | null;
  createdAt: Date;
}

export interface QuestionForReview {
  id: string;
  countryCode: string;
  countryName: string;
  status: string;
  version: number;
  topicId: string;
  difficulty: number;
  correctKeys: string[];
  sourceUrl: string;
  sourceQuote: string | null;
  /** For a question loaded from a file: where in the source its answer is. */
  sourceLocator: string | null;
  origin: 'official' | 'original' | null;
  officialNumber: string | null;
  needsFreshnessCheck: boolean;
  draftedByModel: string | null;
  sourceChangedAt: Date | null;
  lastVerifiedAt: Date | null;
  verifiedBy: string | null;
  /** The wording in the language the question was written in. */
  original: Wording;
  translations: Wording[];
  topics: { id: string; name: string }[];
  passage: {
    documentTitle: string;
    publisher: string | null;
    heading: string | null;
    text: string;
    isCurrent: boolean;
  } | null;
  duplicateOf: { id: string; text: string; status: string } | null;
  history: ReviewDecision[];
}

export async function getQuestionForReview(db: Db, id: string): Promise<QuestionForReview | null> {
  const question = await db.query<{
    id: string;
    country_code: string;
    country_name: string;
    status: string;
    version: number;
    topic_id: string;
    difficulty: number;
    correct_answer: { keys: string[] };
    source_url: string;
    source_quote: string | null;
    source_locator: string | null;
    origin: 'official' | 'original' | null;
    official_number: string | null;
    needs_freshness_check: boolean;
    drafted_by_model: string | null;
    source_changed_at: Date | null;
    last_verified_at: Date | null;
    verified_by: string | null;
    duplicate_of: string | null;
    passage_heading: string | null;
    passage_text: string | null;
    passage_is_current: boolean | null;
    document_title: string | null;
    document_publisher: string | null;
  }>(
    `select q.id, q.country_code, country.name as country_name, q.status::text, q.version,
            q.topic_id, q.difficulty, q.correct_answer, q.source_url, q.source_quote,
            q.source_locator, q.origin, q.official_number, q.needs_freshness_check,
            q.drafted_by_model, q.source_changed_at, q.last_verified_at,
            verifier.display_name as verified_by, q.duplicate_of,
            passage.heading as passage_heading, passage.text as passage_text,
            passage.is_current as passage_is_current,
            document.title as document_title, document.publisher as document_publisher
     from public.questions q
     join public.countries country on country.iso_code = q.country_code
     left join public.profiles verifier on verifier.id = q.verified_by
     left join public.source_passages passage on passage.id = q.source_passage_id
     left join public.source_documents document on document.id = passage.document_id
     where q.id = $1`,
    [id],
  );
  const row = question.rows[0];
  if (!row) return null;

  const wordings = await db.query<{
    locale: string;
    text: string;
    options: QuestionOption[];
    explanation: string | null;
    status: 'draft' | 'approved';
    translated_from: string | null;
  }>(
    `select locale, text, options, explanation, status::text, translated_from
     from public.question_translations
     where question_id = $1
     order by (translated_from is null) desc, created_at, locale`,
    [id],
  );
  const all: Wording[] = wordings.rows.map((wording) => ({
    locale: wording.locale,
    text: wording.text,
    options: wording.options,
    explanation: wording.explanation,
    status: wording.status,
    translatedFrom: wording.translated_from,
  }));
  const [original, ...translations] = all;
  if (!original) return null;

  const topics = await db.query<{ id: string; name: string }>(
    'select id, name from public.topics where country_code = $1 order by sort_order, name',
    [row.country_code],
  );

  let duplicateOf: QuestionForReview['duplicateOf'] = null;
  if (row.duplicate_of) {
    const duplicate = await db.query<{ id: string; text: string; status: string }>(
      `select q.id, q.status::text, t.text
       from public.questions q
       join public.question_translations t on t.question_id = q.id
       where q.id = $1
       order by (t.translated_from is null) desc
       limit 1`,
      [row.duplicate_of],
    );
    duplicateOf = duplicate.rows[0] ?? null;
  }

  const history = await db.query<{
    action: string;
    locale: string | null;
    reviewer: string | null;
    note: string | null;
    created_at: Date;
  }>(
    `select r.action, r.locale, p.display_name as reviewer, r.note, r.created_at
     from public.question_reviews r
     left join public.profiles p on p.id = r.reviewer_id
     where r.question_id = $1
     order by r.created_at desc, r.id desc`,
    [id],
  );

  return {
    id: row.id,
    countryCode: row.country_code,
    countryName: row.country_name,
    status: row.status,
    version: row.version,
    topicId: row.topic_id,
    difficulty: row.difficulty,
    correctKeys: row.correct_answer.keys,
    sourceUrl: row.source_url,
    sourceQuote: row.source_quote,
    sourceLocator: row.source_locator,
    origin: row.origin,
    officialNumber: row.official_number,
    needsFreshnessCheck: row.needs_freshness_check,
    draftedByModel: row.drafted_by_model,
    sourceChangedAt: row.source_changed_at,
    lastVerifiedAt: row.last_verified_at,
    verifiedBy: row.verified_by,
    original,
    translations,
    topics: topics.rows,
    passage:
      row.passage_text == null
        ? null
        : {
            documentTitle: row.document_title ?? '',
            publisher: row.document_publisher,
            heading: row.passage_heading,
            text: row.passage_text,
            isCurrent: row.passage_is_current ?? false,
          },
    duplicateOf,
    history: history.rows.map((entry) => ({
      action: entry.action,
      locale: entry.locale,
      reviewer: entry.reviewer,
      note: entry.note,
      createdAt: entry.created_at,
    })),
  };
}

// --- Decisions ---------------------------------------------------------------------

async function recordDecision(
  db: Db,
  decision: {
    questionId: string;
    reviewerId: string;
    action: string;
    locale?: string;
    note?: string | null;
  },
): Promise<void> {
  await db.query(
    `insert into public.question_reviews (question_id, locale, reviewer_id, action, note)
     values ($1, $2, $3, $4, $5)`,
    [
      decision.questionId,
      decision.locale ?? null,
      decision.reviewerId,
      decision.action,
      decision.note?.trim() || null,
    ],
  );
}

export interface QuestionEdits {
  text: string;
  options: QuestionOption[];
  correctKey: string;
  explanation: string;
  topicId: string;
  difficulty: number;
}

function validateEdits(edits: QuestionEdits): void {
  const problems: string[] = [];
  if (edits.text.trim().length < 1) problems.push('The question needs text.');
  if (edits.options.length < 2) problems.push('The question needs at least two options.');
  if (edits.options.some((option) => !option.text.trim()))
    problems.push('Every option needs text.');
  const texts = new Set(edits.options.map((option) => option.text.trim().toLowerCase()));
  if (texts.size !== edits.options.length) problems.push('The options must all be different.');
  if (!edits.options.some((option) => option.key === edits.correctKey)) {
    problems.push('Choose which option is correct.');
  }
  if (!Number.isInteger(edits.difficulty) || edits.difficulty < 1 || edits.difficulty > 5) {
    problems.push('Difficulty must be from 1 to 5.');
  }
  if (problems.length > 0) throw new ReviewError(problems.join(' '));
}

async function applyEdits(db: Db, questionId: string, edits: QuestionEdits): Promise<void> {
  validateEdits(edits);
  const updated = await db.query(
    `update public.questions
     set topic_id = $2, difficulty = $3, correct_answer = $4
     where id = $1 and status in ('draft', 'in_review', 'published')`,
    [questionId, edits.topicId, edits.difficulty, JSON.stringify({ keys: [edits.correctKey] })],
  );
  if (!updated.rowCount) throw new ReviewError('This question can no longer be edited.');
  await db.query(
    `update public.question_translations
     set text = $2, options = $3, explanation = $4
     where question_id = $1 and translated_from is null`,
    [
      questionId,
      edits.text.trim(),
      JSON.stringify(edits.options.map(({ key, text }) => ({ key, text: text.trim() }))),
      edits.explanation.trim() || null,
    ],
  );
}

/** Saves a reviewer's changes without deciding anything yet. */
export async function saveQuestionEdits(
  pool: pg.Pool,
  questionId: string,
  reviewerId: string,
  edits: QuestionEdits,
): Promise<void> {
  await withTransaction(pool, async (db) => {
    await assertStaff(db, reviewerId);
    await applyEdits(db, questionId, edits);
    await recordDecision(db, { questionId, reviewerId, action: 'edited' });
  });
}

/**
 * Approves a question: it becomes published, stamped with who verified it and
 * when. The wording the reviewer just read (the original language) is approved
 * with it. Any edits made on the review screen are saved first.
 */
export async function approveQuestion(
  pool: pg.Pool,
  questionId: string,
  reviewerId: string,
  edits?: QuestionEdits,
): Promise<void> {
  await withTransaction(pool, async (db) => {
    await assertStaff(db, reviewerId);
    if (edits) await applyEdits(db, questionId, edits);
    const published = await db.query(
      `update public.questions
       set status = 'published', verified_by = $2, last_verified_at = now(),
           source_changed_at = null
       where id = $1 and status in ('draft', 'in_review')`,
      [questionId, reviewerId],
    );
    if (!published.rowCount) {
      throw new ReviewError('Only a draft or a question in review can be approved.');
    }
    await db.query(
      `update public.question_translations
       set status = 'approved', reviewed_by = $2, reviewed_at = now()
       where question_id = $1 and translated_from is null`,
      [questionId, reviewerId],
    );
    await recordDecision(db, { questionId, reviewerId, action: 'approved' });
  });
}

/** Rejects a draft. It is kept so the same question is recognised if drafted again. */
export async function rejectQuestion(
  pool: pg.Pool,
  questionId: string,
  reviewerId: string,
  note: string,
): Promise<void> {
  if (!note.trim()) throw new ReviewError('Say why the question is rejected.');
  await withTransaction(pool, async (db) => {
    await assertStaff(db, reviewerId);
    const rejected = await db.query(
      `update public.questions set status = 'rejected'
       where id = $1 and status in ('draft', 'in_review')`,
      [questionId],
    );
    if (!rejected.rowCount) {
      throw new ReviewError('Only a draft or a question in review can be rejected.');
    }
    await recordDecision(db, { questionId, reviewerId, action: 'rejected', note });
  });
}

/**
 * Confirms that a question is still right after its source changed: clears the
 * flag and renews the verification stamp. If it is no longer right, the
 * reviewer edits or retires it instead.
 */
export async function reverifyQuestion(
  pool: pg.Pool,
  questionId: string,
  reviewerId: string,
  note?: string,
): Promise<void> {
  await withTransaction(pool, async (db) => {
    await assertStaff(db, reviewerId);
    const updated = await db.query(
      `update public.questions
       set source_changed_at = null,
           verified_by = case when status = 'published' then $2 else verified_by end,
           last_verified_at = case when status = 'published' then now() else last_verified_at end
       where id = $1 and source_changed_at is not null`,
      [questionId, reviewerId],
    );
    if (!updated.rowCount) throw new ReviewError('This question is not flagged.');
    await recordDecision(db, { questionId, reviewerId, action: 'reverified', note });
  });
}

/** Takes a published question out of circulation, for example when the law has changed. */
export async function retireQuestion(
  pool: pg.Pool,
  questionId: string,
  reviewerId: string,
  note: string,
): Promise<void> {
  if (!note.trim()) throw new ReviewError('Say why the question is retired.');
  await withTransaction(pool, async (db) => {
    await assertStaff(db, reviewerId);
    const retired = await db.query(
      `update public.questions set status = 'retired', source_changed_at = null
       where id = $1 and status = 'published'`,
      [questionId],
    );
    if (!retired.rowCount) throw new ReviewError('Only a published question can be retired.');
    await recordDecision(db, { questionId, reviewerId, action: 'rejected', note });
  });
}

// --- Translations --------------------------------------------------------------------

export interface TranslationForReview {
  questionId: string;
  countryName: string;
  questionStatus: string;
  correctKeys: string[];
  original: Wording;
  translation: Wording;
}

export async function getTranslationForReview(
  db: Db,
  questionId: string,
  locale: string,
): Promise<TranslationForReview | null> {
  const question = await getQuestionForReview(db, questionId);
  const translation = question?.translations.find((wording) => wording.locale === locale);
  if (!question || !translation) return null;
  return {
    questionId,
    countryName: question.countryName,
    questionStatus: question.status,
    correctKeys: question.correctKeys,
    original: question.original,
    translation,
  };
}

export interface TranslationEdits {
  text: string;
  options: QuestionOption[];
  explanation: string;
}

/** Approves a translation, saving the reviewer's corrections with it. */
export async function approveTranslation(
  pool: pg.Pool,
  questionId: string,
  locale: string,
  reviewerId: string,
  edits: TranslationEdits,
): Promise<void> {
  if (!edits.text.trim() || edits.options.some((option) => !option.text.trim())) {
    throw new ReviewError('The question and every option need text.');
  }
  await withTransaction(pool, async (db) => {
    await assertStaff(db, reviewerId);
    const approved = await db.query(
      `update public.question_translations
       set text = $3, options = $4, explanation = $5,
           status = 'approved', reviewed_by = $6, reviewed_at = now()
       where question_id = $1 and locale = $2 and translated_from is not null`,
      [
        questionId,
        locale,
        edits.text.trim(),
        JSON.stringify(edits.options.map(({ key, text }) => ({ key, text: text.trim() }))),
        edits.explanation.trim() || null,
        reviewerId,
      ],
    );
    if (!approved.rowCount) throw new ReviewError('That translation does not exist.');
    await recordDecision(db, { questionId, reviewerId, action: 'translation_approved', locale });
  });
}

/** Rejects a translation: the draft is removed, so the locale can be translated again. */
export async function rejectTranslation(
  pool: pg.Pool,
  questionId: string,
  locale: string,
  reviewerId: string,
  note: string,
): Promise<void> {
  if (!note.trim()) throw new ReviewError('Say why the translation is rejected.');
  await withTransaction(pool, async (db) => {
    await assertStaff(db, reviewerId);
    const removed = await db.query(
      `delete from public.question_translations
       where question_id = $1 and locale = $2 and translated_from is not null`,
      [questionId, locale],
    );
    if (!removed.rowCount) throw new ReviewError('That translation does not exist.');
    await recordDecision(db, {
      questionId,
      reviewerId,
      action: 'translation_rejected',
      locale,
      note,
    });
  });
}

// --- Many at once ----------------------------------------------------------------------

/** The most one bulk decision covers: more than a reviewer can honestly have read is too many. */
export const BULK_LIMIT = 200;

export const bulkQuestionActions = ['approve', 'reject', 'reverify', 'retire'] as const;
export type BulkQuestionAction = (typeof bulkQuestionActions)[number];

export const bulkTranslationActions = ['approve', 'reject'] as const;
export type BulkTranslationAction = (typeof bulkTranslationActions)[number];

/** What a bulk decision came to: how many went through, and which did not and why. */
export interface BulkOutcome {
  done: number;
  failed: { id: string; reason: string }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function checkBulk(count: number, action: string, note: string) {
  if (count === 0) throw new ReviewError('Select at least one.');
  if (count > BULK_LIMIT) throw new ReviewError(`Select at most ${BULK_LIMIT} at a time.`);
  if ((action === 'reject' || action === 'retire') && !note.trim()) {
    throw new ReviewError(
      action === 'reject' ? 'Say why they are rejected.' : 'Say why they are retired.',
    );
  }
}

/** Runs one decision per item, each on its own: one that cannot go through does not stop the rest. */
async function eachOnItsOwn(
  ids: readonly string[],
  decide: (id: string) => Promise<void>,
): Promise<BulkOutcome> {
  const outcome: BulkOutcome = { done: 0, failed: [] };
  for (const id of ids) {
    try {
      await decide(id);
      outcome.done += 1;
    } catch (error) {
      if (!(error instanceof ReviewError)) throw error;
      outcome.failed.push({ id, reason: error.message });
    }
  }
  return outcome;
}

/**
 * The same decision on several questions: approve (publish as drafted),
 * reject, confirm after a source change, or retire. Each is recorded as the
 * reviewer's own decision, exactly as if made one at a time, so approving in
 * bulk is still the reviewer saying they have checked each one.
 */
export async function reviewQuestionsInBulk(
  pool: pg.Pool,
  reviewerId: string,
  action: BulkQuestionAction,
  questionIds: readonly string[],
  note = '',
): Promise<BulkOutcome> {
  const ids = [...new Set(questionIds)];
  checkBulk(ids.length, action, note);
  return eachOnItsOwn(ids, async (id) => {
    if (!UUID.test(id)) throw new ReviewError('Not a question.');
    if (action === 'approve') await approveQuestion(pool, id, reviewerId);
    else if (action === 'reject') await rejectQuestion(pool, id, reviewerId, note);
    else if (action === 'reverify') await reverifyQuestion(pool, id, reviewerId, note || undefined);
    else await retireQuestion(pool, id, reviewerId, note);
  });
}

/**
 * The same decision on several translations, each named "questionId:locale":
 * approve as drafted, or reject (which removes the draft).
 */
export async function reviewTranslationsInBulk(
  pool: pg.Pool,
  reviewerId: string,
  action: BulkTranslationAction,
  keys: readonly string[],
  note = '',
): Promise<BulkOutcome> {
  const unique = [...new Set(keys)];
  checkBulk(unique.length, action, note);
  return eachOnItsOwn(unique, async (key) => {
    const separator = key.indexOf(':');
    const questionId = key.slice(0, separator);
    const locale = key.slice(separator + 1);
    if (separator < 0 || !UUID.test(questionId) || !locale) {
      throw new ReviewError('Not a translation.');
    }
    if (action === 'reject') {
      await rejectTranslation(pool, questionId, locale, reviewerId, note);
      return;
    }
    await withTransaction(pool, async (db) => {
      await assertStaff(db, reviewerId);
      const approved = await db.query(
        `update public.question_translations
         set status = 'approved', reviewed_by = $3, reviewed_at = now()
         where question_id = $1 and locale = $2 and translated_from is not null
           and status = 'draft'`,
        [questionId, locale, reviewerId],
      );
      if (!approved.rowCount) throw new ReviewError('That translation is not waiting for review.');
      await recordDecision(db, { questionId, reviewerId, action: 'translation_approved', locale });
    });
  });
}
