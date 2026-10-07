import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getTestGuide, getTopicGuide, listCountryFacts, listTestPages } from './countries';

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
          question_pool_size, notes, source_url, last_verified_at, is_current)
       values ($1, 'interview', 'Interview', 'interview', null, null, null, null, null,
               'https://example.org/interview', null, true),
              ($1, 'test', 'Knowledge test', 'written', 20, 15, 45, 100, 'On a computer.',
               'https://example.org/test', '2026-09-01T00:00:00Z', true),
              ($1, 'old-test', 'Old test', 'written', 30, 20, 60, null, null,
               'https://example.org/old', '2026-12-01T00:00:00Z', false)`,
      [PLACED],
    );
  });

  beforeAll(async () => {
    // Three topics. "civics" has three published questions (one also
    // translated into Spanish, one with no explanation) and a draft that must
    // never appear; "history" has one; "culture" has none yet.
    await pool.query(`insert into public.profiles (id, display_name) values ($1, 'Reviewer')`, [
      REVIEWER,
    ]);
    const topics = await pool.query<{ id: string; slug: string }>(
      `insert into public.topics (country_code, slug, name, sort_order)
       values ($1, 'civics', 'Civics', 1), ($1, 'history', 'History', 2),
              ($1, 'culture', 'Culture', 3)
       returning id, slug`,
      [PLACED],
    );
    const topicId = (slug: string) => topics.rows.find((topic) => topic.slug === slug)!.id;
    const questions = await pool.query<{ id: string }>(
      `insert into public.questions
         (country_code, topic_id, difficulty, type, correct_answer, source_url, status,
          verified_by, last_verified_at, source_quote, created_at)
       values
         ($1, $2, 2, 'multiple_choice', '{"keys": ["a"]}', 'https://example.org/guide', 'published',
          $4, '2026-09-01T00:00:00Z', 'The capital is Placeville.', '2026-01-01'),
         ($1, $2, 1, 'multiple_choice', '{"keys": ["b"]}', 'https://example.org/guide', 'published',
          $4, '2026-09-02T00:00:00Z', null, '2026-01-02'),
         ($1, $2, 3, 'multiple_choice', '{"keys": ["a"]}', 'https://example.org/guide', 'published',
          $4, '2026-09-04T00:00:00Z', null, '2026-01-03'),
         ($1, $2, 1, 'multiple_choice', '{"keys": ["a"]}', 'https://example.org/guide', 'draft',
          null, null, null, '2026-01-04'),
         ($1, $3, 1, 'multiple_choice', '{"keys": ["b"]}', 'https://example.org/guide', 'published',
          $4, '2026-09-03T00:00:00Z', null, '2026-01-05')
       returning id`,
      [PLACED, topicId('civics'), topicId('history'), REVIEWER],
    );
    const [capital, unexplained, flag, draft, founding] = questions.rows.map((row) => row.id);
    const options = JSON.stringify([
      { key: 'a', text: 'A' },
      { key: 'b', text: 'B' },
    ]);
    const spanish = JSON.stringify([
      { key: 'a', text: 'A (es)' },
      { key: 'b', text: 'B (es)' },
    ]);
    await pool.query(
      `insert into public.question_translations
         (question_id, locale, text, options, explanation, status, translated_from,
          reviewed_by, reviewed_at)
       values ($1, 'en', 'What is the capital?', $6, 'It is Placeville.', 'approved', null, $8, now()),
              ($1, 'es', '¿Cuál es la capital?', $7, 'Es Placeville.', 'approved', 'en', $8, now()),
              ($2, 'en', 'Unexplained question?', $6, null, 'approved', null, $8, now()),
              ($2, 'es', '¿Borrador?', $7, null, 'draft', 'en', null, null),
              ($3, 'en', 'What is on the flag?', $6, 'A star.', 'approved', null, $8, now()),
              ($4, 'en', 'Draft question?', $6, null, 'draft', null, null, null),
              ($5, 'en', 'When was it founded?', $6, 'In 1900.', 'approved', null, $8, now())`,
      [capital, unexplained, flag, draft, founding, options, spanish, REVIEWER],
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
      slug: 'placedland',
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
      publishedQuestions: 4,
    });
    expect(facts.find((country) => country.isoCode === UNPLACED)).toMatchObject({
      latitude: null,
      longitude: null,
      exams: [],
    });
  });

  it('describes a country’s test: its exams in full, its topics and when it was last checked', async () => {
    const guide = (await getTestGuide(pool, 'placedland', 'en'))!;
    expect(guide).toMatchObject({
      isoCode: PLACED,
      slug: 'placedland',
      name: 'Placedland',
      examLanguages: ['en'],
      publishedQuestions: 4,
      // The newest check of anything on the page: a question here, not the
      // exam, and never the retired format.
      lastVerifiedAt: '2026-09-04T00:00:00.000Z',
    });
    expect(guide.exams).toEqual([
      {
        name: 'Knowledge test',
        formatType: 'written',
        questionCount: 20,
        passMark: 15,
        timeLimitMinutes: 45,
        questionPoolSize: 100,
        notes: 'On a computer.',
        sourceUrl: 'https://example.org/test',
        lastVerifiedAt: '2026-09-01T00:00:00.000Z',
      },
      {
        name: 'Interview',
        formatType: 'interview',
        questionCount: null,
        passMark: null,
        timeLimitMinutes: null,
        questionPoolSize: null,
        notes: null,
        sourceUrl: 'https://example.org/interview',
        lastVerifiedAt: null,
      },
    ]);
    expect(guide.topics).toEqual([
      { slug: 'civics', name: 'Civics', publishedQuestions: 3 },
      { slug: 'history', name: 'History', publishedQuestions: 1 },
      { slug: 'culture', name: 'Culture', publishedQuestions: 0 },
    ]);
    expect(await getTestGuide(pool, 'nowhereland', 'en')).toBeNull();
    // Addressed by slug, not by code.
    expect(await getTestGuide(pool, PLACED.toLowerCase(), 'en')).toBeNull();
  });

  it('samples a country’s questions across its topics, explained and easier ones first', async () => {
    const guide = (await getTestGuide(pool, 'placedland', 'en'))!;
    expect(guide.questions.map((question) => [question.topic.slug, question.text])).toEqual([
      // Each topic's first pick, in topic order, then the second picks.
      ['civics', 'What is the capital?'],
      ['history', 'When was it founded?'],
      ['civics', 'What is on the flag?'],
      ['civics', 'Unexplained question?'],
    ]);
    expect(guide.questions[0]).toMatchObject({
      locale: 'en',
      topic: { slug: 'civics', name: 'Civics' },
      options: [
        { key: 'a', text: 'A' },
        { key: 'b', text: 'B' },
      ],
      correctKeys: ['a'],
      explanation: 'It is Placeville.',
      original: null,
      sourceUrl: 'https://example.org/guide',
      sourceQuote: 'The capital is Placeville.',
      lastVerifiedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(guide.questions.map((question) => question.text)).not.toContain('Draft question?');
    expect((await getTestGuide(pool, 'placedland', 'en', 2))!.questions).toHaveLength(2);
  });

  it('words a question in the reader’s language only where a reviewed translation exists', async () => {
    const guide = (await getTestGuide(pool, 'placedland', 'es'))!;
    const [translated, , , unreviewed] = guide.questions;
    expect(translated).toMatchObject({
      locale: 'es',
      text: '¿Cuál es la capital?',
      options: [
        { key: 'a', text: 'A (es)' },
        { key: 'b', text: 'B (es)' },
      ],
      explanation: 'Es Placeville.',
      // The exam's own wording comes along.
      original: { locale: 'en', text: 'What is the capital?' },
    });
    // A draft translation is never shown: the exam's wording is.
    expect(unreviewed).toMatchObject({
      locale: 'en',
      text: 'Unexplained question?',
      original: null,
    });
  });

  it('describes a topic that has published questions, and no other', async () => {
    const guide = (await getTopicGuide(pool, 'placedland', 'civics', 'en'))!;
    expect(guide.country).toEqual({
      isoCode: PLACED,
      slug: 'placedland',
      name: 'Placedland',
      examLanguages: ['en'],
    });
    expect(guide.topic).toEqual({ slug: 'civics', name: 'Civics', publishedQuestions: 3 });
    // "culture" has no page yet, so nothing links to it.
    expect(guide.otherTopics).toEqual([
      { slug: 'history', name: 'History', publishedQuestions: 1 },
    ]);
    expect(guide.exams.map((exam) => exam.name)).toEqual(['Knowledge test', 'Interview']);
    expect(guide.lastVerifiedAt).toBe('2026-09-04T00:00:00.000Z');
    expect(guide.questions.map((question) => question.text)).toEqual([
      'What is the capital?',
      'What is on the flag?',
      'Unexplained question?',
    ]);
    expect((await getTopicGuide(pool, 'placedland', 'civics', 'en', 1))!.questions).toHaveLength(1);
    expect((await getTopicGuide(pool, 'placedland', 'civics', 'es'))!.questions[0]!.locale).toBe(
      'es',
    );
    expect(await getTopicGuide(pool, 'placedland', 'culture', 'en')).toBeNull();
    expect(await getTopicGuide(pool, 'placedland', 'nope', 'en')).toBeNull();
    expect(await getTopicGuide(pool, 'nowhereland', 'civics', 'en')).toBeNull();
  });

  it('lists every test page to build: each country, and each topic with a published question', async () => {
    const pages = await listTestPages(pool);
    expect(pages).toContainEqual({
      isoCode: PLACED,
      slug: 'placedland',
      lastVerifiedAt: '2026-09-04T00:00:00.000Z',
      topics: [
        { slug: 'civics', lastVerifiedAt: '2026-09-04T00:00:00.000Z' },
        { slug: 'history', lastVerifiedAt: '2026-09-03T00:00:00.000Z' },
      ],
    });
    expect(pages).toContainEqual({
      isoCode: UNPLACED,
      slug: 'unplacedland',
      lastVerifiedAt: null,
      topics: [],
    });
  });
});
