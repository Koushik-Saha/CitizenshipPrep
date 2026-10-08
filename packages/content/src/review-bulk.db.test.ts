import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BULK_LIMIT,
  ensureReviewer,
  listPendingTranslationLocales,
  listQuestionQueue,
  listReviewTopics,
  listTranslationQueue,
  ReviewError,
  reviewQuestionsInBulk,
  reviewTranslationsInBulk,
} from './review';

// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;
// A code no real country uses, and unlike the other test files' codes.
const COUNTRY = 'ZN';
const REVIEWER = { id: 'test:bulk-reviewer', displayName: 'Bulk Reviewer' };
const LEARNER = 'test:bulk-learner';

describe.skipIf(!url)('the review queue: filters and bulk decisions', () => {
  let pool: pg.Pool;
  const ids: Record<string, string> = {};

  const cleanUp = async () => {
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
    await pool.query('delete from public.profiles where id = any($1)', [[REVIEWER.id, LEARNER]]);
  };
  const status = async (id: string) =>
    (
      await pool.query<{ status: string; verified_by: string | null }>(
        'select status::text, verified_by from public.questions where id = $1',
        [id],
      )
    ).rows[0]!;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    await ensureReviewer(pool, REVIEWER, 'reviewer');
    await pool.query(`insert into public.profiles (id, display_name) values ($1, 'Learner')`, [
      LEARNER,
    ]);
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages)
       values ($1, 'Bulkland', true, '{en}')`,
      [COUNTRY],
    );
    const topics = await pool.query<{ id: string; slug: string }>(
      `insert into public.topics (country_code, slug, name, sort_order)
       values ($1, 'history', 'History', 1), ($1, 'rights', 'Rights and duties', 2)
       returning id, slug`,
      [COUNTRY],
    );
    const topic = (slug: string) => topics.rows.find((row) => row.slug === slug)!.id;
    const add = async (key: string, text: string, topicSlug: string, state = 'in_review') => {
      const { rows } = await pool.query<{ id: string }>(
        `insert into public.questions
           (country_code, topic_id, difficulty, type, correct_answer, source_url, status)
         values ($1, $2, 1, 'multiple_choice', '{"keys": ["a"]}', 'https://example.org/guide', $3)
         returning id`,
        [COUNTRY, topic(topicSlug), state],
      );
      ids[key] = rows[0]!.id;
      await pool.query(
        `insert into public.question_translations (question_id, locale, text, options, status)
         values ($1, 'en', $2, '[{"key":"a","text":"A"},{"key":"b","text":"B"}]', 'draft')`,
        [ids[key], text],
      );
    };
    await add('capital', 'What is the capital of Bulkland?', 'history');
    await add('founded', 'When was Bulkland founded?', 'history');
    await add('vote', 'Who can vote? (100% of adults)', 'rights');
    await add('jury', 'Who serves on a jury?', 'rights', 'draft');
    // One is flagged as a possible duplicate of another.
    await pool.query('update public.questions set duplicate_of = $2 where id = $1', [
      ids.founded,
      ids.capital,
    ]);
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('narrows the queue by words, topic and flag', async () => {
    const texts = async (filters: Parameters<typeof listQuestionQueue>[2]) =>
      (await listQuestionQueue(pool, 'pending', filters)).map((question) => question.text);

    expect(await texts({ countryCode: COUNTRY })).toHaveLength(4);
    // A country alone still works as it always did.
    expect(await texts(COUNTRY)).toHaveLength(4);
    expect(await texts({ countryCode: COUNTRY, search: 'bulkland' })).toEqual([
      'What is the capital of Bulkland?',
      'When was Bulkland founded?',
    ]);
    // What is typed is taken literally: "%" is a per cent sign, not "anything".
    expect(await texts({ countryCode: COUNTRY, search: '100%' })).toEqual([
      'Who can vote? (100% of adults)',
    ]);
    expect(await texts({ countryCode: COUNTRY, search: '%' })).toHaveLength(1);
    expect(await texts({ countryCode: COUNTRY, topic: 'rights' })).toEqual([
      'Who can vote? (100% of adults)',
      'Who serves on a jury?',
    ]);
    expect(await texts({ countryCode: COUNTRY, flag: 'duplicate' })).toEqual([
      'When was Bulkland founded?',
    ]);
    expect(await texts({ countryCode: COUNTRY, flag: 'no-source' })).toHaveLength(4);
    expect(await texts({ countryCode: COUNTRY, flag: 'has-source' })).toEqual([]);
    expect(await texts({ countryCode: COUNTRY, topic: 'history', search: 'founded' })).toEqual([
      'When was Bulkland founded?',
    ]);

    expect(await listReviewTopics(pool, COUNTRY)).toEqual([
      { slug: 'history', name: 'History' },
      { slug: 'rights', name: 'Rights and duties' },
    ]);
  });

  it('refuses a bulk decision with nothing selected, too much selected, or no reason given', async () => {
    const refusal = async (run: Promise<unknown>) =>
      run.then(
        () => null,
        (error: unknown) => (error instanceof ReviewError ? error.message : String(error)),
      );
    expect(await refusal(reviewQuestionsInBulk(pool, REVIEWER.id, 'approve', []))).toBe(
      'Select at least one.',
    );
    const tooMany = Array.from(
      { length: BULK_LIMIT + 1 },
      (_, i) => `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    expect(await refusal(reviewQuestionsInBulk(pool, REVIEWER.id, 'approve', tooMany))).toBe(
      `Select at most ${BULK_LIMIT} at a time.`,
    );
    expect(
      await refusal(reviewQuestionsInBulk(pool, REVIEWER.id, 'reject', [ids.jury!], '  ')),
    ).toBe('Say why they are rejected.');
    // Nothing was touched.
    expect((await status(ids.jury!)).status).toBe('draft');
  });

  it('is only for reviewers', async () => {
    const outcome = await reviewQuestionsInBulk(pool, LEARNER, 'approve', [ids.capital!]);
    expect(outcome.done).toBe(0);
    expect(outcome.failed).toHaveLength(1);
    expect((await status(ids.capital!)).status).toBe('in_review');
  });

  it('approves several at once, each recorded as the reviewer’s own decision', async () => {
    const outcome = await reviewQuestionsInBulk(pool, REVIEWER.id, 'approve', [
      ids.capital!,
      ids.founded!,
      ids.capital!, // Named twice: decided once.
      'not-a-question',
      '10000000-0000-4000-8000-000000000000',
    ]);
    expect(outcome.done).toBe(2);
    // The two that could not go through say why, and did not stop the others.
    expect(outcome.failed).toEqual([
      { id: 'not-a-question', reason: 'Not a question.' },
      {
        id: '10000000-0000-4000-8000-000000000000',
        reason: 'Only a draft or a question in review can be approved.',
      },
    ]);
    for (const key of ['capital', 'founded']) {
      expect(await status(ids[key]!)).toEqual({ status: 'published', verified_by: REVIEWER.id });
    }
    const { rows } = await pool.query<{ n: string }>(
      `select count(*) as n from public.question_reviews
       where question_id = any($1) and reviewer_id = $2 and action = 'approved'`,
      [[ids.capital, ids.founded], REVIEWER.id],
    );
    expect(Number(rows[0]!.n)).toBe(2);
    // The wording they were approved in is approved with them.
    const wording = await pool.query<{ status: string }>(
      'select status::text from public.question_translations where question_id = $1',
      [ids.capital],
    );
    expect(wording.rows[0]!.status).toBe('approved');
    // Approving again changes nothing and says so.
    const again = await reviewQuestionsInBulk(pool, REVIEWER.id, 'approve', [ids.capital!]);
    expect(again).toMatchObject({ done: 0, failed: [{ id: ids.capital }] });
  });

  it('rejects several at once with one reason', async () => {
    const outcome = await reviewQuestionsInBulk(
      pool,
      REVIEWER.id,
      'reject',
      [ids.vote!, ids.jury!],
      'Not in the guide.',
    );
    expect(outcome).toEqual({ done: 2, failed: [] });
    expect((await status(ids.vote!)).status).toBe('rejected');
    expect(await listQuestionQueue(pool, 'pending', COUNTRY)).toEqual([]);
  });

  it('confirms and retires flagged questions in bulk', async () => {
    await pool.query('update public.questions set source_changed_at = now() where id = any($1)', [
      [ids.capital, ids.founded],
    ]);
    expect(await listQuestionQueue(pool, 'source-changed', COUNTRY)).toHaveLength(2);
    expect(await reviewQuestionsInBulk(pool, REVIEWER.id, 'reverify', [ids.capital!])).toEqual({
      done: 1,
      failed: [],
    });
    expect(
      await reviewQuestionsInBulk(pool, REVIEWER.id, 'retire', [ids.founded!], 'The law changed.'),
    ).toEqual({ done: 1, failed: [] });
    expect((await status(ids.capital!)).status).toBe('published');
    expect((await status(ids.founded!)).status).toBe('retired');
    expect(await listQuestionQueue(pool, 'source-changed', COUNTRY)).toEqual([]);
  });

  it('approves and rejects translations in bulk, and narrows them by language and words', async () => {
    const options = '[{"key":"a","text":"A"},{"key":"b","text":"B"}]';
    await pool.query(
      `insert into public.question_translations
         (question_id, locale, text, options, status, translated_from)
       values ($1, 'es', '¿Cuál es la capital de Bulkland?', $2, 'draft', 'en'),
              ($1, 'fr', 'Quelle est la capitale de Bulkland ?', $2, 'draft', 'en'),
              ($1, 'vi', 'Thủ đô của Bulkland là gì?', $2, 'draft', 'en')`,
      [ids.capital, options],
    );
    const waiting = async (filters: Parameters<typeof listTranslationQueue>[1]) =>
      (await listTranslationQueue(pool, filters)).map((translation) => translation.locale);
    expect(await waiting({ countryCode: COUNTRY })).toEqual(['es', 'fr', 'vi']);
    expect(await waiting({ countryCode: COUNTRY, locale: 'fr' })).toEqual(['fr']);
    expect(await waiting({ countryCode: COUNTRY, search: 'capitale' })).toEqual(['fr']);
    // The original's words find its translations too.
    expect(await waiting({ countryCode: COUNTRY, search: 'What is the capital' })).toHaveLength(3);
    expect(await listPendingTranslationLocales(pool)).toEqual(
      expect.arrayContaining(['es', 'fr', 'vi']),
    );

    const approved = await reviewTranslationsInBulk(pool, REVIEWER.id, 'approve', [
      `${ids.capital}:es`,
      `${ids.capital}:fr`,
      `${ids.capital}:de`,
      'nonsense',
    ]);
    expect(approved.done).toBe(2);
    expect(approved.failed.map((failure) => failure.reason)).toEqual([
      'That translation is not waiting for review.',
      'Not a translation.',
    ]);
    const spanish = await pool.query<{ status: string; reviewed_by: string; text: string }>(
      `select status::text, reviewed_by, text from public.question_translations
       where question_id = $1 and locale = 'es'`,
      [ids.capital],
    );
    // Approved as drafted: the words are untouched.
    expect(spanish.rows[0]).toEqual({
      status: 'approved',
      reviewed_by: REVIEWER.id,
      text: '¿Cuál es la capital de Bulkland?',
    });

    const rejected = await reviewTranslationsInBulk(
      pool,
      REVIEWER.id,
      'reject',
      [`${ids.capital}:vi`],
      'Wrong register.',
    );
    expect(rejected).toEqual({ done: 1, failed: [] });
    expect(await waiting({ countryCode: COUNTRY })).toEqual([]);
  });
});
