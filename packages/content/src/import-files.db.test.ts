import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPool } from './db';
import { ImportError, importQuestionFiles, storedAnswer } from './pipeline/import-files';
import type { QuestionRecord } from './records';
import { upsertCountry } from './repository';
import { ensureReviewer, reviewQuestionsInBulk } from './review';

const url = process.env.TEST_DATABASE_URL;
const COUNTRY = 'ZL';
const REVIEWER = { id: 'test:import-reviewer', displayName: 'Import Reviewer' };
const GUIDE = 'https://example.test/zl-guide.pdf';

const base = {
  country_iso: COUNTRY,
  exam_version: 'civics-2025',
  topic: 'How Loadland Is Governed',
  subtopic: null,
  type: 'multiple_choice',
  difficulty: 2,
  language: 'en',
  question: 'How many chambers does the Loadland parliament have?',
  options: ['One', 'Two', 'Three', 'Four'],
  correct_option_index: 1,
  explanation: 'The Loadland parliament has two chambers. Laws must pass both of them.',
  source: {
    title: 'Life in Loadland',
    url: GUIDE,
    section_or_page: 'Chapter 2, page 14',
    quote_under_25_words: 'Parliament is made up of two chambers.',
    publisher: 'Loadland Ministry of the Interior',
    license: 'CC BY 4.0',
  },
  origin: 'original',
  official_number: null,
  style: 'standard',
  needs_freshness_check: false,
  region: null,
  status: 'draft',
  created_at: '2026-10-08T12:00:00Z',
  verified_at: null,
};

const ids = Array.from({ length: 6 }, () => crypto.randomUUID());
const passed = { ...base, id: ids[0]! };
const { correct_option_index: _one, ...answerless } = base;
void _one;
const spoken = {
  ...answerless,
  id: ids[1]!,
  type: 'free_response',
  style: 'interview',
  origin: 'official',
  official_number: '12',
  needs_freshness_check: true,
  question: 'Who is the head of state of Loadland?',
  options: [],
  correct_answers: ['The President', 'President'],
} as unknown as QuestionRecord;
const rejected = { ...base, id: ids[2]!, question: 'How many seas border Loadland in the north?' };
const unjudged = {
  ...base,
  id: ids[3]!,
  question: 'In which year was Loadland founded as a state?',
};
const stale = {
  ...base,
  id: ids[4]!,
  status: 'needs_review',
  question: 'Which river crosses Loadland?',
};
const regional = {
  ...base,
  id: ids[5]!,
  region: 'ZL-N',
  question: 'What is the capital of the north?',
};

function dataDir(questions: unknown[], review: string | null): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'oathly-import-'));
  mkdirSync(path.join(dir, 'questions', COUNTRY), { recursive: true });
  mkdirSync(path.join(dir, 'sources', COUNTRY), { recursive: true });
  writeFileSync(path.join(dir, 'sources', COUNTRY, 'topic_map.md'), '# Topics\n');
  writeFileSync(
    path.join(dir, 'sources', COUNTRY, 'sources.json'),
    JSON.stringify({
      iso: COUNTRY,
      researched_at: '2026-10-08T12:00:00Z',
      sources: [
        {
          id: 'guide',
          kind: 'question_bank',
          title: 'Life in Loadland',
          url: GUIDE,
          publisher: 'Loadland Ministry of the Interior',
          publication_date: null,
          version: null,
          language: 'en',
          region: null,
          license: {
            class: 'open_license',
            name: 'CC BY 4.0',
            commercial_use: 'allowed',
            text: 'Licensed under CC BY 4.0.',
            url: 'https://example.test/copyright',
          },
          file: null,
          sha256: null,
          text_sha256: null,
          bytes: null,
          retrieved_at: '2026-10-08T12:00:00Z',
          notes: 'Not downloaded for this test.',
        },
      ],
      not_found: ['study_guide', 'practice_test', 'interview_questions', 'format_page'].map(
        (kind) => ({
          kind,
          searched: 'Not looked for in this test.',
        }),
      ),
    }),
  );
  const official = questions.filter((q) => (q as QuestionRecord).origin === 'official');
  const own = questions.filter((q) => (q as QuestionRecord).origin !== 'official');
  if (official.length) {
    writeFileSync(path.join(dir, 'questions', COUNTRY, 'official.json'), JSON.stringify(official));
  }
  writeFileSync(
    path.join(dir, 'questions', COUNTRY, 'original_government.json'),
    JSON.stringify(own),
  );
  if (review !== null) writeFileSync(path.join(dir, 'questions', COUNTRY, 'review.csv'), review);
  return dir;
}

describe('storedAnswer', () => {
  it('keys the options and names the right ones, by type', () => {
    expect(storedAnswer(passed as QuestionRecord)).toEqual({
      type: 'multiple_choice',
      options: [
        { key: 'a', text: 'One' },
        { key: 'b', text: 'Two' },
        { key: 'c', text: 'Three' },
        { key: 'd', text: 'Four' },
      ],
      correctKeys: ['b'],
    });
    // Asked aloud: every accepted answer is an option, and any one is right.
    expect(storedAnswer(spoken)).toEqual({
      type: 'free_response',
      options: [
        { key: 'a', text: 'The President' },
        { key: 'b', text: 'President' },
      ],
      correctKeys: ['a', 'b'],
    });
    const several = {
      ...answerless,
      id: ids[0]!,
      type: 'multi_select',
      origin: 'official',
      correct_answers: ['Two', 'Four'],
    } as unknown as QuestionRecord;
    expect(storedAnswer(several).correctKeys).toEqual(['b', 'd']);
    expect(
      storedAnswer({
        ...base,
        id: ids[0]!,
        type: 'true_false',
        options: ['True', 'False'],
        correct_option_index: 0,
      } as QuestionRecord),
    ).toMatchObject({ type: 'true_false', correctKeys: ['a'] });
  });
});

describe.skipIf(!url)('loading question files into the review queue', () => {
  let pool: pg.Pool;
  const review = (rows: [string, string, string][]) =>
    ['id,verdict,reason', ...rows.map((row) => row.join(','))].join('\n') + '\n';
  const everything = [passed, spoken, rejected, unjudged, stale, regional];
  const judged = review([
    [passed.id, 'pass', ''],
    [spoken.id, 'fixed', 'Page reference corrected'],
    [rejected.id, 'reject', 'Not in the guide'],
    [stale.id, 'pass', ''],
    [regional.id, 'pass', ''],
  ]);

  async function cleanUp() {
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.topics where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
    await pool.query('delete from public.profiles where id = $1', [REVIEWER.id]);
  }

  beforeAll(async () => {
    pool = createPool(url);
    await cleanUp();
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('refuses when there is nothing sound to load', async () => {
    const dir = dataDir(everything, judged);
    await expect(importQuestionFiles(pool, dir, COUNTRY)).rejects.toThrow(
      /not a country in this database yet/,
    );
    await upsertCountry(pool, {
      isoCode: COUNTRY,
      name: 'Loadland',
      hasExam: true,
      examLanguages: ['en'],
    });
    await expect(importQuestionFiles(pool, dataDir(everything, null), COUNTRY)).rejects.toThrow(
      /no review\.csv/,
    );
    await expect(
      importQuestionFiles(pool, dataDir([{ ...passed, status: 'published' }], judged), COUNTRY),
    ).rejects.toThrow(ImportError);
    await expect(
      importQuestionFiles(pool, dataDir(everything, 'id,result\n'), COUNTRY),
    ).rejects.toThrow(/do not validate/);
    const { rows } = await pool.query('select 1 from public.questions where country_code = $1', [
      COUNTRY,
    ]);
    expect(rows).toHaveLength(0);
  });

  it('loads what the fact-check passed, as waiting for review and nothing more', async () => {
    const dir = dataDir(everything, judged);
    expect(await importQuestionFiles(pool, dir, COUNTRY, { dryRun: true })).toMatchObject({
      added: 3,
      updated: 0,
    });
    expect(
      (await pool.query('select 1 from public.questions where country_code = $1', [COUNTRY])).rows,
    ).toHaveLength(0);

    const outcome = await importQuestionFiles(pool, dir, COUNTRY);
    expect(outcome.added).toBe(3);
    expect(outcome.updated).toBe(0);
    expect(outcome.skipped).toEqual(
      expect.arrayContaining([
        { id: rejected.id, reason: 'the fact-check says "reject"' },
        { id: unjudged.id, reason: 'not fact-checked' },
        { id: stale.id, reason: 'its source has changed: marked needs_review in the file' },
      ]),
    );

    const { rows } = await pool.query(
      `select q.id, q.status, q.type, q.correct_answer, q.origin, q.official_number, q.region_code,
              q.source_locator, q.source_quote, q.needs_freshness_check, q.verified_by,
              q.last_verified_at, q.published_at, t.slug as topic, tr.locale, tr.text, tr.options,
              tr.status as wording
       from public.questions q
       join public.topics t on t.id = q.topic_id
       join public.question_translations tr on tr.question_id = q.id
       where q.country_code = $1 order by q.official_number nulls last, q.region_code nulls first`,
      [COUNTRY],
    );
    expect(rows.map((row) => row.id).sort()).toEqual([passed.id, spoken.id, regional.id].sort());
    for (const row of rows) {
      // In the queue, unverified and unpublished: that is a reviewer's to change.
      expect(row).toMatchObject({
        status: 'in_review',
        verified_by: null,
        last_verified_at: null,
        published_at: null,
        topic: 'how-loadland-is-governed',
        locale: 'en',
        wording: 'draft',
      });
    }
    expect(rows[0]).toMatchObject({
      id: spoken.id,
      type: 'free_response',
      correct_answer: { keys: ['a', 'b'] },
      origin: 'official',
      official_number: '12',
      needs_freshness_check: true,
    });
    expect(rows.find((row) => row.id === passed.id)).toMatchObject({
      type: 'multiple_choice',
      correct_answer: { keys: ['b'] },
      origin: 'original',
      source_locator: 'Chapter 2, page 14',
      source_quote: 'Parliament is made up of two chambers.',
      text: base.question,
    });
    expect(rows.find((row) => row.id === regional.id)).toMatchObject({ region_code: 'ZL-N' });
  });

  it('updates a question still waiting, and leaves a reviewer’s decision alone', async () => {
    await ensureReviewer(pool, REVIEWER, 'reviewer');
    await reviewQuestionsInBulk(pool, REVIEWER.id, 'approve', [passed.id]);
    const edited = [
      { ...passed, question: 'How many houses does the Loadland parliament have?' },
      { ...regional, difficulty: 4 },
      spoken,
    ];
    const outcome = await importQuestionFiles(
      pool,
      dataDir(
        edited,
        review([
          [passed.id, 'pass', ''],
          [regional.id, 'pass', ''],
          [spoken.id, 'pass', ''],
        ]),
      ),
      COUNTRY,
    );
    expect(outcome).toMatchObject({ added: 0, updated: 2 });
    expect(outcome.skipped).toEqual([{ id: passed.id, reason: 'already published in the app' }]);
    const { rows } = await pool.query<{
      id: string;
      status: string;
      difficulty: number;
      text: string;
    }>(
      `select q.id, q.status, q.difficulty, tr.text from public.questions q
       join public.question_translations tr on tr.question_id = q.id where q.country_code = $1`,
      [COUNTRY],
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    // Published by a reviewer: the file's new wording did not reach it.
    expect(byId.get(passed.id)).toMatchObject({ status: 'published', text: base.question });
    expect(byId.get(regional.id)).toMatchObject({ status: 'in_review', difficulty: 4 });
  });
});
