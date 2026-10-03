import type { Db } from './db';
import type { ExistingQuestion } from './duplicates';
import type { CheckedDraft, QuestionOption } from './schemas';
import type { MediaType } from './source';
import type { Passage } from './text';

// Plain SQL for the pipeline. Every function takes the connection to use, so
// callers decide where transactions begin and end.

export interface Country {
  isoCode: string;
  name: string;
  examLanguages: string[];
}

export async function getCountry(db: Db, isoCode: string): Promise<Country | null> {
  const { rows } = await db.query<{ iso_code: string; name: string; exam_languages: string[] }>(
    'select iso_code, name, exam_languages from public.countries where iso_code = $1',
    [isoCode],
  );
  const row = rows[0];
  return row ? { isoCode: row.iso_code, name: row.name, examLanguages: row.exam_languages } : null;
}

export async function upsertCountry(
  db: Db,
  country: Country & { hasExam: boolean },
): Promise<void> {
  await db.query(
    `insert into public.countries (iso_code, name, has_exam, exam_languages)
     values ($1, $2, $3, $4)
     on conflict (iso_code) do update
       set name = excluded.name,
           has_exam = excluded.has_exam,
           exam_languages = excluded.exam_languages`,
    [country.isoCode, country.name, country.hasExam, country.examLanguages],
  );
}

export interface ExamFormatInput {
  countryCode: string;
  slug: string;
  name: string;
  formatType: 'written' | 'oral' | 'interview' | 'language';
  questionCount: number | null;
  passMark: number | null;
  timeLimitMinutes: number | null;
  questionPoolSize: number | null;
  notes: string | null;
  sourceUrl: string;
  /** Validated with parseBlueprint() from @oathly/core before it gets here. */
  blueprint: Record<string, unknown> | null;
}

export async function upsertExamFormat(db: Db, format: ExamFormatInput): Promise<void> {
  // Not stamped as verified: that is for a person who has read the source.
  await db.query(
    `insert into public.exam_formats
       (country_code, slug, name, format_type, question_count, pass_mark, time_limit_minutes,
        question_pool_size, notes, source_url, blueprint)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (country_code, slug) do update
       set name = excluded.name,
           format_type = excluded.format_type,
           question_count = excluded.question_count,
           pass_mark = excluded.pass_mark,
           time_limit_minutes = excluded.time_limit_minutes,
           question_pool_size = excluded.question_pool_size,
           notes = excluded.notes,
           source_url = excluded.source_url,
           blueprint = excluded.blueprint,
           last_verified_at = null`,
    [
      format.countryCode,
      format.slug,
      format.name,
      format.formatType,
      format.questionCount,
      format.passMark,
      format.timeLimitMinutes,
      format.questionPoolSize,
      format.notes,
      format.sourceUrl,
      format.blueprint ? JSON.stringify(format.blueprint) : null,
    ],
  );
}

export interface Topic {
  id: string;
  slug: string;
  name: string;
}

export async function listTopics(db: Db, countryCode: string): Promise<Topic[]> {
  const { rows } = await db.query<Topic>(
    'select id, slug, name from public.topics where country_code = $1 order by sort_order, name',
    [countryCode],
  );
  return rows;
}

/** Returns the topic's id, creating the topic if the country does not have it yet. */
export async function ensureTopic(
  db: Db,
  countryCode: string,
  topic: { slug: string; name: string },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.topics (country_code, slug, name, sort_order)
     values ($1, $2, $3,
             (select coalesce(max(sort_order), 0) + 1 from public.topics where country_code = $1))
     on conflict (country_code, slug) do update set slug = excluded.slug
     returning id`,
    [countryCode, topic.slug, topic.name],
  );
  return rows[0]!.id;
}

// --- Sources -----------------------------------------------------------------

export interface SourceDocument {
  id: string;
  countryCode: string;
  title: string;
  sourceUrl: string;
  locale: string;
  contentHash: string;
  isRefetchable: boolean;
}

interface SourceDocumentRow {
  id: string;
  country_code: string;
  title: string;
  source_url: string;
  locale: string;
  content_hash: string;
  is_refetchable: boolean;
}

const documentColumns = 'id, country_code, title, source_url, locale, content_hash, is_refetchable';

function toDocument(row: SourceDocumentRow): SourceDocument {
  return {
    id: row.id,
    countryCode: row.country_code,
    title: row.title,
    sourceUrl: row.source_url,
    locale: row.locale,
    contentHash: row.content_hash,
    isRefetchable: row.is_refetchable,
  };
}

export async function getDocument(db: Db, id: string): Promise<SourceDocument | null> {
  const { rows } = await db.query<SourceDocumentRow>(
    `select ${documentColumns} from public.source_documents where id = $1`,
    [id],
  );
  return rows[0] ? toDocument(rows[0]) : null;
}

export async function findDocumentByUrl(
  db: Db,
  countryCode: string,
  sourceUrl: string,
): Promise<SourceDocument | null> {
  const { rows } = await db.query<SourceDocumentRow>(
    `select ${documentColumns} from public.source_documents
     where country_code = $1 and source_url = $2`,
    [countryCode, sourceUrl],
  );
  return rows[0] ? toDocument(rows[0]) : null;
}

export async function listDocuments(
  db: Db,
  filter: { countryCode?: string; refetchableOnly?: boolean } = {},
): Promise<SourceDocument[]> {
  const { rows } = await db.query<SourceDocumentRow>(
    `select ${documentColumns} from public.source_documents
     where ($1::text is null or country_code = $1)
       and (not $2::boolean or is_refetchable)
     order by country_code, created_at`,
    [filter.countryCode ?? null, filter.refetchableOnly ?? false],
  );
  return rows.map(toDocument);
}

export interface NewDocument {
  countryCode: string;
  title: string;
  publisher: string | null;
  sourceUrl: string;
  mediaType: MediaType;
  locale: string;
  license: string;
  isRefetchable: boolean;
  rawHash: string;
  contentHash: string;
  byteSize: number;
}

export async function insertDocument(db: Db, document: NewDocument): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.source_documents
       (country_code, title, publisher, source_url, media_type, locale, license, is_refetchable,
        raw_hash, content_hash, byte_size)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning id`,
    [
      document.countryCode,
      document.title,
      document.publisher,
      document.sourceUrl,
      document.mediaType,
      document.locale,
      document.license,
      document.isRefetchable,
      document.rawHash,
      document.contentHash,
      document.byteSize,
    ],
  );
  return rows[0]!.id;
}

export async function recordDocumentCheck(
  db: Db,
  id: string,
  change: { rawHash: string; contentHash: string; byteSize: number } | null,
): Promise<void> {
  if (!change) {
    await db.query('update public.source_documents set last_checked_at = now() where id = $1', [
      id,
    ]);
    return;
  }
  await db.query(
    `update public.source_documents
     set raw_hash = $2, content_hash = $3, byte_size = $4,
         fetched_at = now(), last_checked_at = now(), changed_at = now()
     where id = $1`,
    [id, change.rawHash, change.contentHash, change.byteSize],
  );
}

export interface StoredPassage {
  id: string;
  ordinal: number;
  heading: string | null;
  text: string;
  contentHash: string;
}

export async function listCurrentPassages(db: Db, documentId: string): Promise<StoredPassage[]> {
  const { rows } = await db.query<{
    id: string;
    ordinal: number;
    heading: string | null;
    text: string;
    content_hash: string;
  }>(
    `select id, ordinal, heading, text, content_hash from public.source_passages
     where document_id = $1 and is_current
     order by ordinal`,
    [documentId],
  );
  return rows.map((row) => ({
    id: row.id,
    ordinal: row.ordinal,
    heading: row.heading,
    text: row.text,
    contentHash: row.content_hash,
  }));
}

/** Current passages that no question cites yet, in document order. */
export async function listPassagesWithoutQuestions(
  db: Db,
  documentId: string,
): Promise<StoredPassage[]> {
  const passages = await listCurrentPassages(db, documentId);
  const { rows } = await db.query<{ source_passage_id: string }>(
    `select distinct source_passage_id from public.questions
     where source_passage_id = any($1::uuid[])`,
    [passages.map((passage) => passage.id)],
  );
  const cited = new Set(rows.map((row) => row.source_passage_id));
  return passages.filter((passage) => !cited.has(passage.id));
}

export async function insertPassages(
  db: Db,
  documentId: string,
  passages: readonly Passage[],
): Promise<void> {
  if (passages.length === 0) return;
  await db.query(
    `insert into public.source_passages (document_id, ordinal, heading, text, content_hash)
     select $1, ordinal, heading, text, content_hash
     from unnest($2::int[], $3::text[], $4::text[], $5::text[])
       as passage (ordinal, heading, text, content_hash)`,
    [
      documentId,
      passages.map((passage) => passage.ordinal),
      passages.map((passage) => passage.heading),
      passages.map((passage) => passage.text),
      passages.map((passage) => passage.contentHash),
    ],
  );
}

export async function setPassageOrdinals(
  db: Db,
  ordinals: readonly { id: string; ordinal: number }[],
): Promise<void> {
  if (ordinals.length === 0) return;
  await db.query(
    `update public.source_passages as passage
     set ordinal = moved.ordinal
     from unnest($1::uuid[], $2::int[]) as moved (id, ordinal)
     where passage.id = moved.id`,
    [ordinals.map((entry) => entry.id), ordinals.map((entry) => entry.ordinal)],
  );
}

/**
 * Marks passages as no longer part of the source and flags every live question
 * that cites one of them. Returns how many questions were flagged.
 */
export async function supersedePassages(db: Db, passageIds: readonly string[]): Promise<number> {
  if (passageIds.length === 0) return 0;
  await db.query(
    `update public.source_passages set is_current = false, superseded_at = now()
     where id = any($1::uuid[])`,
    [passageIds],
  );
  const { rowCount } = await db.query(
    `update public.questions set source_changed_at = now()
     where source_passage_id = any($1::uuid[])
       and status in ('draft', 'in_review', 'published')`,
    [passageIds],
  );
  return rowCount ?? 0;
}

// --- Questions ---------------------------------------------------------------

/** Every question for the country with its original wording, for duplicate checks. */
export async function listQuestionTexts(db: Db, countryCode: string): Promise<ExistingQuestion[]> {
  const { rows } = await db.query<ExistingQuestion>(
    `select q.id, t.text
     from public.questions q
     join public.question_translations t on t.question_id = q.id and t.translated_from is null
     where q.country_code = $1`,
    [countryCode],
  );
  return rows;
}

export interface NewDraft {
  countryCode: string;
  topicId: string;
  passageId: string;
  sourceUrl: string;
  locale: string;
  model: string;
  duplicateOf: string | null;
  draft: CheckedDraft;
}

/** Saves a drafted question and its wording. Both start as drafts. */
export async function insertDraftQuestion(db: Db, input: NewDraft): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.questions
       (country_code, topic_id, difficulty, type, correct_answer, source_url, status,
        source_passage_id, source_quote, drafted_by_model, duplicate_of)
     values ($1, $2, $3, 'multiple_choice', $4, $5, 'draft', $6, $7, $8, $9)
     returning id`,
    [
      input.countryCode,
      input.topicId,
      input.draft.difficulty,
      JSON.stringify({ keys: [input.draft.correctKey] }),
      input.sourceUrl,
      input.passageId,
      input.draft.sourceQuote,
      input.model,
      input.duplicateOf,
    ],
  );
  const questionId = rows[0]!.id;
  await db.query(
    `insert into public.question_translations
       (question_id, locale, text, options, explanation, drafted_by_model)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      questionId,
      input.locale,
      input.draft.text,
      JSON.stringify(input.draft.options),
      input.draft.explanation,
      input.model,
    ],
  );
  return questionId;
}

export interface TranslatableQuestion {
  id: string;
  sourceLocale: string;
  text: string;
  options: QuestionOption[];
  explanation: string | null;
}

/** Questions that have no wording in `locale` yet, with the wording to translate from. */
export async function listQuestionsMissingLocale(
  db: Db,
  filter: { countryCode: string; locale: string; includeUnpublished: boolean; limit: number },
): Promise<TranslatableQuestion[]> {
  const { rows } = await db.query<{
    id: string;
    locale: string;
    text: string;
    options: QuestionOption[];
    explanation: string | null;
  }>(
    `select q.id, t.locale, t.text, t.options, t.explanation
     from public.questions q
     join public.question_translations t on t.question_id = q.id and t.translated_from is null
     where q.country_code = $1
       and (q.status = 'published' or ($3 and q.status in ('draft', 'in_review')))
       and t.locale <> $2
       and not exists (
         select 1 from public.question_translations existing
         where existing.question_id = q.id and existing.locale = $2
       )
     order by q.created_at
     limit $4`,
    [filter.countryCode, filter.locale, filter.includeUnpublished, filter.limit],
  );
  return rows.map((row) => ({
    id: row.id,
    sourceLocale: row.locale,
    text: row.text,
    options: row.options,
    explanation: row.explanation,
  }));
}

export async function insertTranslationDraft(
  db: Db,
  input: {
    questionId: string;
    locale: string;
    translatedFrom: string;
    model: string;
    text: string;
    options: QuestionOption[];
    explanation: string;
  },
): Promise<void> {
  await db.query(
    `insert into public.question_translations
       (question_id, locale, text, options, explanation, translated_from, drafted_by_model)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.questionId,
      input.locale,
      input.text,
      JSON.stringify(input.options),
      input.explanation || null,
      input.translatedFrom,
      input.model,
    ],
  );
}
