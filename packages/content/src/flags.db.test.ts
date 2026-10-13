import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  closeFlag,
  closeFlagsOnQuestion,
  countOpenFlags,
  listOpenFlags,
  questionOfOpenFlag,
} from './flags';
import { ensureReviewer, ReviewError } from './review';

// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;
// A code no real country uses, and unlike the other test files' codes.
const COUNTRY = 'ZG';
const REVIEWER = { id: 'test:flags-reviewer', displayName: 'Flags Reviewer' };
const LEARNERS = ['test:flags-learner-1', 'test:flags-learner-2'];

describe.skipIf(!url)('the reviewers’ queue of learners’ reports', () => {
  let pool: pg.Pool;
  const ids: Record<string, string> = {};
  const mine = async () => listOpenFlags(pool, { countryCode: COUNTRY });

  const cleanUp = async () => {
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
    await pool.query('delete from public.profiles where id = any($1)', [
      [REVIEWER.id, ...LEARNERS],
    ]);
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    await ensureReviewer(pool, REVIEWER, 'reviewer');
    for (const id of LEARNERS)
      await pool.query('insert into public.profiles (id) values ($1)', [id]);
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages)
       values ($1, 'Flagland', true, '{en}')`,
      [COUNTRY],
    );
    const topic = await pool.query<{ id: string }>(
      `insert into public.topics (country_code, slug, name) values ($1, 'history', 'History')
       returning id`,
      [COUNTRY],
    );
    for (const key of ['one', 'two']) {
      const { rows } = await pool.query<{ id: string }>(
        `insert into public.questions
           (country_code, topic_id, difficulty, type, correct_answer, source_url, status,
            verified_by, last_verified_at)
         values ($1, $2, 1, 'multiple_choice', '{"keys": ["b"]}', 'https://example.org/guide',
                 'published', $3, now())
         returning id`,
        [COUNTRY, topic.rows[0]!.id, REVIEWER.id],
      );
      ids[key] = rows[0]!.id;
      await pool.query(
        `insert into public.question_translations
           (question_id, locale, text, options, explanation, status, reviewed_by, reviewed_at)
         values ($1, 'en', $2, '[{"key":"a","text":"1066"},{"key":"b","text":"1215"}]',
                 'It was sealed in 1215.', 'approved', $3, now())`,
        [rows[0]!.id, `Question ${key}: when was the charter sealed?`, REVIEWER.id],
      );
    }
    // A translation made later must not stand in for the original wording.
    await pool.query(
      `insert into public.question_translations
         (question_id, locale, text, options, status, translated_from)
       values ($1, 'es', 'Pregunta uno', '[{"key":"a","text":"1066"},{"key":"b","text":"1215"}]',
               'draft', 'en')`,
      [ids.one],
    );
    const flag = async (
      key: string,
      question: string,
      user: string,
      reason: string,
      at: string,
    ) => {
      const { rows } = await pool.query<{ id: string }>(
        `insert into public.content_flags (question_id, user_id, locale, reason, details, created_at)
         values ($1, $2, 'es', $3, $4, $5) returning id`,
        [ids[question], user, reason, key === 'second' ? null : `Note for ${key}`, at],
      );
      ids[key] = rows[0]!.id;
    };
    await flag('first', 'one', LEARNERS[0]!, 'incorrect', '2026-10-01T10:00:00Z');
    await flag('second', 'one', LEARNERS[1]!, 'typo', '2026-10-02T10:00:00Z');
    await flag('third', 'two', LEARNERS[0]!, 'outdated', '2026-10-03T10:00:00Z');
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('lists open reports oldest first, each with its question and the answer', async () => {
    const queue = await mine();
    expect(queue.map((flag) => flag.id)).toEqual([ids.first, ids.second, ids.third]);
    expect(queue[0]).toMatchObject({
      reason: 'incorrect',
      details: 'Note for first',
      locale: 'es',
      reportedAt: '2026-10-01T10:00:00.000Z',
      reporterId: LEARNERS[0],
      reportsOnQuestion: 2,
      question: {
        id: ids.one,
        countryCode: COUNTRY,
        status: 'published',
        topic: 'History',
        // As it was written, not the translation the learner was reading.
        locale: 'en',
        text: 'Question one: when was the charter sealed?',
        options: [
          { key: 'a', text: '1066' },
          { key: 'b', text: '1215' },
        ],
        correctKeys: ['b'],
        explanation: 'It was sealed in 1215.',
        sourceUrl: 'https://example.org/guide',
      },
    });
    expect(queue[1]).toMatchObject({ reason: 'typo', details: null, reportsOnQuestion: 2 });
    expect(queue[2]!.reportsOnQuestion).toBe(1);
    expect(await countOpenFlags(pool)).toBeGreaterThanOrEqual(3);
  });

  it('narrows to one question, and to a page', async () => {
    const forTwo = await listOpenFlags(pool, { questionId: ids.two });
    expect(forTwo.map((flag) => flag.id)).toEqual([ids.third]);
    expect(await listOpenFlags(pool, { countryCode: COUNTRY }, 2)).toHaveLength(2);
    // Something that is not an id narrows nothing.
    expect(
      (await listOpenFlags(pool, { countryCode: COUNTRY, questionId: 'not-an-id' })).length,
    ).toBe(3);
  });

  it('knows which question an open report is about', async () => {
    expect(await questionOfOpenFlag(pool, ids.first!)).toBe(ids.one);
    expect(await questionOfOpenFlag(pool, 'not-an-id')).toBeNull();
    expect(await questionOfOpenFlag(pool, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('closes a report once, saying who and why', async () => {
    expect(
      await closeFlag(pool, ids.first!, REVIEWER.id, 'dismissed', ' The answer is right. '),
    ).toEqual({
      questionId: ids.one,
    });
    const { rows } = await pool.query(
      `select status::text, resolved_by, resolution_note, resolved_at is not null as dated
       from public.content_flags where id = $1`,
      [ids.first],
    );
    expect(rows[0]).toEqual({
      status: 'dismissed',
      resolved_by: REVIEWER.id,
      resolution_note: 'The answer is right.',
      dated: true,
    });
    expect((await mine()).map((flag) => flag.id)).toEqual([ids.second, ids.third]);
    // Closed: it is not an open report on anything now.
    expect(await questionOfOpenFlag(pool, ids.first!)).toBeNull();
    // Someone else got there first.
    await expect(closeFlag(pool, ids.first!, REVIEWER.id, 'resolved')).rejects.toThrow(
      'already been closed',
    );
  });

  it('lets only staff close one, and only a real one', async () => {
    await expect(closeFlag(pool, ids.second!, LEARNERS[0]!, 'dismissed')).rejects.toThrow(
      ReviewError,
    );
    await expect(closeFlag(pool, 'not-an-id', REVIEWER.id, 'dismissed')).rejects.toThrow(
      'does not exist',
    );
    await expect(
      closeFlag(pool, '00000000-0000-4000-8000-000000000000', REVIEWER.id, 'dismissed'),
    ).rejects.toThrow('already been closed');
    expect((await mine()).map((flag) => flag.id)).toEqual([ids.second, ids.third]);
  });

  it('closes every report on a question when the question is dealt with', async () => {
    expect(await closeFlagsOnQuestion(pool, ids.one!, REVIEWER.id, 'Corrected the spelling.')).toBe(
      1,
    );
    expect(await closeFlagsOnQuestion(pool, ids.one!, REVIEWER.id)).toBe(0);
    expect((await mine()).map((flag) => flag.id)).toEqual([ids.third]);
    const { rows } = await pool.query(
      'select status::text, resolution_note from public.content_flags where id = $1',
      [ids.second],
    );
    expect(rows[0]).toEqual({ status: 'resolved', resolution_note: 'Corrected the spelling.' });
    // A report closed without a note has none.
    await closeFlag(pool, ids.third!, REVIEWER.id, 'resolved');
    const third = await pool.query(
      'select resolution_note from public.content_flags where id = $1',
      [ids.third],
    );
    expect(third.rows[0]!.resolution_note).toBeNull();
  });
});
