import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { explain } from './explain';
import type { GenerateRequest, Generation, TextGenerator } from './generator';
import { askTutor, findStudyMaterial } from './tutor';
import { quotaFor } from './usage';

// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;
const USER = 'test:ai-api';
const COUNTRY = 'ZW';

/** Stands in for Claude: records each request and replies with a fixed text. */
function fakeGenerator(reply = 'Because the passage says so.') {
  const requests: GenerateRequest[] = [];
  const generator: TextGenerator = {
    model: 'fake-model',
    generate(request): Generation {
      requests.push(request);
      return {
        textStream: (async function* () {
          yield reply.slice(0, 5);
          yield reply.slice(5);
        })(),
        result: Promise.resolve({
          text: reply,
          usage: { inputTokens: 120, outputTokens: 40, cacheReadTokens: 100, cacheWriteTokens: 0 },
          model: 'fake-model',
          refused: false,
        }),
      };
    },
  };
  return { generator, requests };
}

const read = (stream: ReadableStream<Uint8Array>) => new Response(stream).text();

describe.skipIf(!url)('AI explanations and tutor against the database', () => {
  let pool: pg.Pool;
  let questionId: string;
  let draftId: string;

  async function cleanUp() {
    await pool.query('delete from public.profiles where id = $1', [USER]);
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.source_documents where country_code = $1', [COUNTRY]);
    await pool.query(`delete from public.profiles where id = 'test:ai-reviewer'`);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    await pool.query(`insert into public.profiles (id) values ($1), ('test:ai-reviewer')`, [USER]);
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages) values ($1, 'Lakeland', true, '{en}')`,
      [COUNTRY],
    );
    const topic = (
      await pool.query<{ id: string }>(
        `insert into public.topics (country_code, slug, name) values ($1, 'government', 'Government') returning id`,
        [COUNTRY],
      )
    ).rows[0]!.id;
    const document = (
      await pool.query<{ id: string }>(
        `insert into public.source_documents (country_code, title, source_url, media_type, locale, license, raw_hash, content_hash, byte_size)
         values ($1, 'Lakeland Guide', 'https://example.test/lakeland', 'text/plain', 'en', 'public-domain', repeat('a', 64), repeat('b', 64), 10) returning id`,
        [COUNTRY],
      )
    ).rows[0]!.id;
    const passage = (
      await pool.query<{ id: string }>(
        `insert into public.source_passages (document_id, ordinal, heading, text, content_hash)
         values ($1, 0, 'Parliament', 'Lakeland is governed by the Lake Council, which has nine members elected every five years.', repeat('c', 64)) returning id`,
        [document],
      )
    ).rows[0]!.id;
    const insertQuestion = async (status: string, text: string) => {
      const id = (
        await pool.query<{ id: string }>(
          `insert into public.questions (country_code, topic_id, difficulty, type, correct_answer, source_url, status, verified_by, last_verified_at, source_passage_id, source_quote)
           values ($1, $2, 2, 'multiple_choice', '{"keys": ["b"]}', 'https://example.test/lakeland', $3, $4, $5, $6, 'nine members') returning id`,
          [
            COUNTRY,
            topic,
            status,
            status === 'published' ? 'test:ai-reviewer' : null,
            status === 'published' ? new Date() : null,
            passage,
          ],
        )
      ).rows[0]!.id;
      await pool.query(
        `insert into public.question_translations (question_id, locale, text, options, status, reviewed_by, reviewed_at)
         values ($1, 'en', $2, '[{"key":"a","text":"Five"},{"key":"b","text":"Nine"}]', $3, $4, $5)`,
        [
          id,
          text,
          status === 'published' ? 'approved' : 'draft',
          status === 'published' ? 'test:ai-reviewer' : null,
          status === 'published' ? new Date() : null,
        ],
      );
      return id;
    };
    questionId = await insertQuestion('published', 'How many members does the Lake Council have?');
    draftId = await insertQuestion('draft', 'An unreviewed question');
    await pool.query(
      `insert into public.user_countries (user_id, country_code, study_locale, is_primary) values ($1, $2, 'de', true)`,
      [USER, COUNTRY],
    );
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('generates an explanation once, from the passage, in the study language, and logs the usage', async () => {
    const { generator, requests } = fakeGenerator();
    const first = await explain(pool, generator, USER, questionId);
    expect(first).toMatchObject({ kind: 'stream', locale: 'de' });
    expect(await read((first as { stream: ReadableStream<Uint8Array> }).stream)).toBe(
      'Because the passage says so.',
    );
    expect(requests[0]!.context).toContain('nine members elected every five years');
    expect(requests[0]!.messages[0]!.content).toContain('Explain in: German (de)');

    const usage = await pool.query(
      'select feature, model, input_tokens, output_tokens, cache_read_tokens from public.ai_usage where user_id = $1',
      [USER],
    );
    expect(usage.rows).toEqual([
      {
        feature: 'explanation',
        model: 'fake-model',
        input_tokens: 120,
        output_tokens: 40,
        cache_read_tokens: 100,
      },
    ]);

    const again = await explain(pool, generator, USER, questionId);
    expect(again).toEqual({ kind: 'cached', text: 'Because the passage says so.', locale: 'de' });
    expect(requests).toHaveLength(1);
  });

  it('makes a fresh explanation after the answer changes (new version)', async () => {
    await pool.query(
      `update public.questions set correct_answer = '{"keys": ["a"]}' where id = $1`,
      [questionId],
    );
    const { generator } = fakeGenerator('New explanation.');
    expect((await explain(pool, generator, USER, questionId)).kind).toBe('stream');
    await pool.query(
      `update public.questions set correct_answer = '{"keys": ["b"]}' where id = $1`,
      [questionId],
    );
  });

  it('will not explain unpublished or unknown questions', async () => {
    const { generator, requests } = fakeGenerator();
    expect(await explain(pool, generator, USER, draftId)).toEqual({ kind: 'unavailable' });
    expect(await explain(pool, generator, USER, 'nope')).toEqual({ kind: 'unavailable' });
    expect(requests).toHaveLength(0);
  });

  it('stops at the plan’s limit', async () => {
    await pool.query(
      `insert into public.ai_usage (user_id, feature, model, input_tokens, output_tokens)
       select $1, 'tutor', 'fake-model', 1, 1 from generate_series(1, 15)`,
      [USER],
    );
    const { generator, requests } = fakeGenerator();
    const outcome = await askTutor(pool, generator, USER, {
      countryCode: COUNTRY,
      messages: [{ role: 'user', content: 'Council?' }],
    });
    expect(outcome).toMatchObject({
      kind: 'limited',
      quota: { allowed: false, limit: 15, remaining: 0 },
    });
    expect(requests).toHaveLength(0);

    await pool.query(
      `insert into public.subscriptions (user_id, plan, status, provider) values ($1, 'pro_monthly', 'active', 'manual')`,
      [USER],
    );
    expect((await quotaFor(pool, USER, 'tutor', new Date())).remaining).toBe(135);
  });

  it('answers the tutor from the matching study material only', async () => {
    const { generator, requests } = fakeGenerator('The Lake Council has nine members.');
    const outcome = await askTutor(pool, generator, USER, {
      countryCode: COUNTRY,
      messages: [{ role: 'user', content: 'How many members does the council have?' }],
    });
    expect(outcome.kind).toBe('stream');
    expect(await read((outcome as { stream: ReadableStream<Uint8Array> }).stream)).toBe(
      'The Lake Council has nine members.',
    );
    expect(requests[0]!.system).toContain('Lakeland citizenship test');
    expect(requests[0]!.context).toContain('nine members elected every five years');
    expect(requests[0]!.context).toContain('How many members does the Lake Council have?');
    expect(requests[0]!.context).not.toContain('An unreviewed question');
  });

  it('finds nothing for an unrelated question, and refuses countries the learner does not study', async () => {
    expect(await findStudyMaterial(pool, COUNTRY, 'chocolate cake recipe')).toEqual([]);
    expect(await findStudyMaterial(pool, COUNTRY, '?!')).toEqual([]);
    const { generator } = fakeGenerator();
    expect(
      await askTutor(pool, generator, USER, {
        countryCode: 'US',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).toEqual({ kind: 'not-studying' });
  });
});
