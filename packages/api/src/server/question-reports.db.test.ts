import { parseQuestionReport } from '@oathly/core';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { reportQuestion } from './question-reports';

// Runs against the local database (`pnpm db:start`); skipped without one.
const url = process.env.TEST_DATABASE_URL;
// A code no real country uses, and unlike the other test files' codes.
const COUNTRY = 'ZB';
const OTHER = 'ZC';
const REVIEWER = 'test:report-reviewer';
const LEARNER = 'test:report-learner';
const STRANGER = 'test:report-stranger';

describe.skipIf(!url)('a learner reporting a question, against the database', () => {
  let pool: pg.Pool;
  const ids: Record<string, string> = {};
  const report = (input: unknown) => parseQuestionReport(input)!;
  const flags = async (userId: string) =>
    (
      await pool.query<{
        reason: string;
        details: string | null;
        locale: string | null;
        status: string;
      }>(
        `select reason::text, details, locale, status::text from public.content_flags
         where user_id = $1 order by created_at, reason`,
        [userId],
      )
    ).rows;

  const cleanUp = async () => {
    await pool.query('delete from public.questions where country_code = any($1)', [
      [COUNTRY, OTHER],
    ]);
    await pool.query('delete from public.countries where iso_code = any($1)', [[COUNTRY, OTHER]]);
    await pool.query('delete from public.profiles where id = any($1)', [
      [REVIEWER, LEARNER, STRANGER],
    ]);
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    for (const id of [REVIEWER, LEARNER, STRANGER]) {
      await pool.query('insert into public.profiles (id) values ($1)', [id]);
    }
    for (const [code, name] of [
      [COUNTRY, 'Reportland'],
      [OTHER, 'Otherland'],
    ]) {
      await pool.query(
        `insert into public.countries (iso_code, name, has_exam, exam_languages)
         values ($1, $2, true, '{en}')`,
        [code, name],
      );
    }
    const add = async (key: string, country: string, status: string) => {
      const topic = await pool.query<{ id: string }>(
        `insert into public.topics (country_code, slug, name) values ($1, $2, 'Civics')
         returning id`,
        [country, `civics-${key}`],
      );
      const { rows } = await pool.query<{ id: string }>(
        `insert into public.questions
           (country_code, topic_id, difficulty, type, correct_answer, source_url, status,
            verified_by, last_verified_at)
         values ($1, $2, 1, 'multiple_choice', '{"keys": ["a"]}', 'https://example.org/guide',
                 $3, $4, $5)
         returning id`,
        [
          country,
          topic.rows[0]!.id,
          status,
          status === 'published' ? REVIEWER : null,
          status === 'published' ? new Date() : null,
        ],
      );
      ids[key] = rows[0]!.id;
    };
    await add('published', COUNTRY, 'published');
    await add('waiting', COUNTRY, 'in_review');
    await add('elsewhere', OTHER, 'published');
    await pool.query(`insert into public.user_countries (user_id, country_code) values ($1, $2)`, [
      LEARNER,
      COUNTRY,
    ]);
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('saves a report on a question the learner can see', async () => {
    expect(
      await reportQuestion(
        pool,
        LEARNER,
        ids.published!,
        report({ reason: 'incorrect', details: 'The answer is b.', locale: 'es' }),
      ),
    ).toBe('saved');
    expect(await flags(LEARNER)).toEqual([
      { reason: 'incorrect', details: 'The answer is b.', locale: 'es', status: 'open' },
    ]);
  });

  it('keeps one open report of a kind, and takes another kind', async () => {
    expect(
      await reportQuestion(pool, LEARNER, ids.published!, report({ reason: 'incorrect' })),
    ).toBe('already');
    expect(await reportQuestion(pool, LEARNER, ids.published!, report({ reason: 'typo' }))).toBe(
      'saved',
    );
    expect((await flags(LEARNER)).map((flag) => flag.reason)).toEqual(['incorrect', 'typo']);
    // The first one's words were not replaced by the repeat.
    expect((await flags(LEARNER))[0]!.details).toBe('The answer is b.');
  });

  it('takes the same report again once the first has been closed', async () => {
    await pool.query(
      `update public.content_flags set status = 'dismissed', resolved_by = $2
       where user_id = $1 and reason = 'typo'`,
      [LEARNER, REVIEWER],
    );
    expect(await reportQuestion(pool, LEARNER, ids.published!, report({ reason: 'typo' }))).toBe(
      'saved',
    );
    expect((await flags(LEARNER)).filter((flag) => flag.reason === 'typo')).toHaveLength(2);
  });

  it('takes nothing for a question the learner cannot see', async () => {
    const outdated = report({ reason: 'outdated' });
    // Not published yet.
    expect(await reportQuestion(pool, LEARNER, ids.waiting!, outdated)).toBe('missing');
    // Another country's, which they do not study.
    expect(await reportQuestion(pool, LEARNER, ids.elsewhere!, outdated)).toBe('missing');
    // Someone who studies nothing.
    expect(await reportQuestion(pool, STRANGER, ids.published!, outdated)).toBe('missing');
    // A question that does not exist.
    expect(
      await reportQuestion(pool, LEARNER, '00000000-0000-4000-8000-000000000000', outdated),
    ).toBe('missing');
    expect(await flags(STRANGER)).toEqual([]);
  });
});
