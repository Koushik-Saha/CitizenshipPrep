import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { listExamFormatsForReview, markExamFormatChecked } from './exam-formats';
import { upsertExamFormat } from './repository';
import { ensureReviewer } from './review';

// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;
// A code and a name no real country uses, and unlike the other test files'
// (the slug comes from the name, and the api tests run alongside these).
const COUNTRY = 'ZE';
const REVIEWER = { id: 'test:exam-check-reviewer', displayName: 'Exam Checker' };

const format = {
  countryCode: COUNTRY,
  slug: 'test',
  name: 'Formatland test',
  formatType: 'written' as const,
  questionCount: 20,
  passMark: 15,
  timeLimitMinutes: 45,
  questionPoolSize: null,
  notes: null,
  sourceUrl: 'https://example.org/formatland',
  blueprint: null,
};

describe.skipIf(!url)('checking exam formats against their sources', () => {
  let pool: pg.Pool;
  const mine = async () =>
    (await listExamFormatsForReview(pool)).find((row) => row.countryCode === COUNTRY)!;

  const cleanUp = async () => {
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
    await pool.query('delete from public.profiles where id = $1', [REVIEWER.id]);
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    await ensureReviewer(pool, REVIEWER, 'reviewer');
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages)
       values ($1, 'Formatland', true, '{en}')`,
      [COUNTRY],
    );
    await upsertExamFormat(pool, format);
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('lists a format as not checked until a reviewer checks it, and then by whom', async () => {
    const before = await mine();
    expect(before).toMatchObject({
      countryName: 'Formatland',
      countrySlug: 'formatland',
      questionCount: 20,
      lastVerifiedAt: null,
      verifiedByName: null,
    });

    const now = new Date('2026-10-15T09:00:00Z');
    expect(await markExamFormatChecked(pool, before.id, REVIEWER.id, now)).toEqual({
      countryCode: COUNTRY,
      countrySlug: 'formatland',
      name: 'Formatland test',
    });
    expect(await mine()).toMatchObject({
      lastVerifiedAt: now.toISOString(),
      verifiedByName: 'Exam Checker',
    });
  });

  it('needs checking again once its facts change', async () => {
    await upsertExamFormat(pool, { ...format, passMark: 16 });
    expect(await mine()).toMatchObject({
      passMark: 16,
      lastVerifiedAt: null,
      verifiedByName: null,
    });
  });

  it('checks nothing that is not a current format', async () => {
    expect(await markExamFormatChecked(pool, 'not-an-id', REVIEWER.id)).toBeNull();
    expect(
      await markExamFormatChecked(pool, '00000000-0000-4000-8000-000000000000', REVIEWER.id),
    ).toBeNull();
  });
});
