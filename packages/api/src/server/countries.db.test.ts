import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { listCountryFacts } from './countries';

// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;
// Codes no real country uses, and unlike the other test files' codes.
const PLACED = 'XP';
const UNPLACED = 'XU';

describe.skipIf(!url)('public country facts against the database', () => {
  let pool: pg.Pool;

  const cleanUp = () =>
    pool.query('delete from public.countries where iso_code = any($1)', [[PLACED, UNPLACED]]);

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages, latitude, longitude)
       values ($1, 'Placedland', true, '{en}', 12.5, -45.25),
              ($2, 'Unplacedland', true, '{fr,en}', null, null)`,
      [PLACED, UNPLACED],
    );
    await pool.query(
      `insert into public.exam_formats
         (country_code, slug, name, format_type, question_count, pass_mark, time_limit_minutes,
          source_url, last_verified_at, is_current)
       values ($1, 'interview', 'Interview', 'interview', null, null, null,
               'https://example.org/interview', null, true),
              ($1, 'test', 'Knowledge test', 'written', 20, 15, 45,
               'https://example.org/test', '2026-09-01T00:00:00Z', true),
              ($1, 'old-test', 'Old test', 'written', 30, 20, 60,
               'https://example.org/old', null, false)`,
      [PLACED],
    );
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('lists exam countries with coordinates, current formats written-first, and question counts', async () => {
    const facts = await listCountryFacts(pool);
    const placed = facts.find((country) => country.isoCode === PLACED);
    expect(placed).toEqual({
      isoCode: PLACED,
      name: 'Placedland',
      examLanguages: ['en'],
      latitude: 12.5,
      longitude: -45.25,
      exams: [
        {
          name: 'Knowledge test',
          formatType: 'written',
          questionCount: 20,
          passMark: 15,
          timeLimitMinutes: 45,
          sourceUrl: 'https://example.org/test',
          lastVerifiedAt: '2026-09-01T00:00:00.000Z',
        },
        {
          name: 'Interview',
          formatType: 'interview',
          questionCount: null,
          passMark: null,
          timeLimitMinutes: null,
          sourceUrl: 'https://example.org/interview',
          lastVerifiedAt: null,
        },
      ],
      publishedQuestions: 0,
    });
    expect(facts.find((country) => country.isoCode === UNPLACED)).toMatchObject({
      latitude: null,
      longitude: null,
      exams: [],
    });
  });
});
