import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getCountryGuide, getTopicGuide, listCountryFacts, listGuidePaths } from './countries';

// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;
// Codes no real country uses, and unlike the other test files' codes.
const PLACED = 'XP';
const UNPLACED = 'XU';
const REVIEWER = 'test-guide-reviewer';

describe.skipIf(!url)('public country facts against the database', () => {
  let pool: pg.Pool;

  const cleanUp = async () => {
    const codes = [PLACED, UNPLACED];
    await pool.query('delete from public.questions where country_code = any($1)', [codes]);
    await pool.query('delete from public.countries where iso_code = any($1)', [[PLACED, UNPLACED]]);
    await pool.query('delete from public.profiles where id = $1', [REVIEWER]);
  };

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

  beforeAll(async () => {
    // Two topics; in "civics", two published questions (one also translated
    // into Spanish) and a draft that must never appear.
    await pool.query(`insert into public.profiles (id, display_name) values ($1, 'Reviewer')`, [
      REVIEWER,
    ]);
    const topics = await pool.query<{ id: string; slug: string }>(
      `insert into public.topics (country_code, slug, name, sort_order)
       values ($1, 'civics', 'Civics', 1), ($1, 'history', 'History', 2)
       returning id, slug`,
      [PLACED],
    );
    const civics = topics.rows.find((topic) => topic.slug === 'civics')!.id;
    const questions = await pool.query<{ id: string; status: string }>(
      `insert into public.questions
         (country_code, topic_id, difficulty, type, correct_answer, source_url, status,
          verified_by, last_verified_at, source_quote)
       values
         ($1, $2, 1, 'multiple_choice', '{"keys": ["a"]}', 'https://example.org/guide', 'published',
          $3, '2026-09-01T00:00:00Z', 'The capital is Placeville.'),
         ($1, $2, 2, 'multiple_choice', '{"keys": ["b"]}', 'https://example.org/guide', 'published',
          $3, '2026-09-02T00:00:00Z', null),
         ($1, $2, 1, 'multiple_choice', '{"keys": ["a"]}', 'https://example.org/guide', 'draft',
          null, null, null)
       returning id, status`,
      [PLACED, civics, REVIEWER],
    );
    const [first, second, draft] = questions.rows.map((row) => row.id);
    const options = JSON.stringify([
      { key: 'a', text: 'A' },
      { key: 'b', text: 'B' },
    ]);
    await pool.query(
      `insert into public.question_translations
         (question_id, locale, text, options, explanation, status, translated_from,
          reviewed_by, reviewed_at)
       values ($1, 'en', 'What is the capital?', $4, 'It is Placeville.', 'approved', null, $5, now()),
              ($1, 'es', '¿Cuál es la capital?', $4, null, 'approved', 'en', $5, now()),
              ($2, 'en', 'Second question?', $4, null, 'approved', null, $5, now()),
              ($3, 'en', 'Draft question?', $4, null, 'draft', null, null, null)`,
      [first, second, draft, options, REVIEWER],
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
      publishedQuestions: 2,
    });
    expect(facts.find((country) => country.isoCode === UNPLACED)).toMatchObject({
      latitude: null,
      longitude: null,
      exams: [],
    });
  });

  it('describes a country with its topics and how many published questions each has', async () => {
    const guide = await getCountryGuide(pool, PLACED.toLowerCase());
    expect(guide?.name).toBe('Placedland');
    expect(guide?.publishedQuestions).toBe(2);
    expect(guide?.topics).toEqual([
      { slug: 'civics', name: 'Civics', publishedQuestions: 2 },
      { slug: 'history', name: 'History', publishedQuestions: 0 },
    ]);
    expect(await getCountryGuide(pool, 'XX')).toBeNull();
  });

  it('shows only published questions, in the exam’s own language', async () => {
    const guide = (await getTopicGuide(pool, PLACED, 'civics'))!;
    expect(guide.topic).toEqual({ slug: 'civics', name: 'Civics', publishedQuestions: 2 });
    expect(guide.otherTopics.map((topic) => topic.slug)).toEqual(['history']);
    expect(guide.questions).toHaveLength(2);
    expect(guide.questions[0]).toMatchObject({
      locale: 'en',
      text: 'What is the capital?',
      correctKeys: ['a'],
      explanation: 'It is Placeville.',
      sourceQuote: 'The capital is Placeville.',
      lastVerifiedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(guide.questions.map((question) => question.text)).not.toContain('Draft question?');
    expect((await getTopicGuide(pool, PLACED, 'civics', 1))!.questions).toHaveLength(1);
    expect(await getTopicGuide(pool, PLACED, 'nope')).toBeNull();
    expect(await getTopicGuide(pool, 'XX', 'civics')).toBeNull();
  });

  it('lists every country and topic page to build', async () => {
    const paths = await listGuidePaths(pool);
    expect(paths).toContainEqual({ isoCode: PLACED, topics: ['civics', 'history'] });
    expect(paths).toContainEqual({ isoCode: UNPLACED, topics: [] });
  });
});
