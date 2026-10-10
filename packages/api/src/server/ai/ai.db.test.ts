import { freeQuestionIds, FREE_QUESTIONS_PER_COUNTRY } from '@oathly/core';
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
  let insertQuestion: (status: string, text: string) => Promise<string>;

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
    insertQuestion = async (status: string, text: string) => {
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

  it('counts a request when it is made, whether or not the reply is ever read', async () => {
    await pool.query('delete from public.ai_usage where user_id = $1', [USER]);
    await pool.query('delete from public.subscriptions where user_id = $1', [USER]);
    const { generator } = fakeGenerator();
    const ask = () =>
      askTutor(pool, generator, USER, {
        countryCode: COUNTRY,
        messages: [{ role: 'user', content: 'Council?' }],
      });
    const before = (await quotaFor(pool, USER, 'tutor', new Date())).remaining;
    // A client that hangs up: the reply is never read to its end.
    const outcome = await ask();
    expect(outcome.kind).toBe('stream');
    await (outcome as { stream: ReadableStream<Uint8Array> }).stream.cancel();
    expect((await quotaFor(pool, USER, 'tutor', new Date())).remaining).toBe(before - 1);
  });

  it('answers only as many requests as are left, however many arrive at once', async () => {
    await pool.query('delete from public.ai_usage where user_id = $1', [USER]);
    await pool.query(
      `insert into public.ai_usage (user_id, feature, model, input_tokens, output_tokens)
       select $1, 'tutor', 'fake-model', 1, 1 from generate_series(1, 14)`,
      [USER],
    );
    const { generator, requests } = fakeGenerator();
    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () =>
        askTutor(pool, generator, USER, {
          countryCode: COUNTRY,
          messages: [{ role: 'user', content: 'Council?' }],
        }),
      ),
    );
    const answered = outcomes.filter((outcome) => outcome.kind === 'stream');
    expect(answered.length).toBeLessThanOrEqual(1);
    expect(requests.length).toBeLessThanOrEqual(1);
    await Promise.all(
      answered.map((outcome) => read((outcome as { stream: ReadableStream<Uint8Array> }).stream)),
    );
    // Nobody is left holding more than the plan allows.
    const { rows } = await pool.query(
      `select count(*)::int as used from public.ai_usage where user_id = $1 and feature = 'tutor'`,
      [USER],
    );
    expect(rows[0].used).toBeLessThanOrEqual(15);
  });

  it('records what a finished reply cost on the request that was counted', async () => {
    await pool.query('delete from public.ai_usage where user_id = $1', [USER]);
    const { generator } = fakeGenerator('Nine members.');
    const outcome = await askTutor(pool, generator, USER, {
      countryCode: COUNTRY,
      messages: [{ role: 'user', content: 'Council?' }],
    });
    await read((outcome as { stream: ReadableStream<Uint8Array> }).stream);
    const { rows } = await pool.query(
      `select model, input_tokens, output_tokens, cache_read_tokens from public.ai_usage
       where user_id = $1 and feature = 'tutor'`,
      [USER],
    );
    expect(rows).toEqual([
      { model: 'fake-model', input_tokens: 120, output_tokens: 40, cache_read_tokens: 100 },
    ]);
  });

  it('pauses free accounts first when the whole service has used its day, then everyone', async () => {
    await pool.query('delete from public.ai_usage where user_id = $1', [USER]);
    const { generator, requests } = fakeGenerator();
    const ask = (dailyLimit: number) =>
      askTutor(
        pool,
        generator,
        USER,
        { countryCode: COUNTRY, messages: [{ role: 'user', content: 'Council?' }] },
        new Date(),
        { dailyLimit },
      );
    // Some use by the service today, whatever else is in the database.
    await pool.query(
      `insert into public.ai_usage (user_id, feature, model, input_tokens, output_tokens)
       select $1, 'explanation', 'fake-model', 1, 1 from generate_series(1, 2)`,
      [USER],
    );
    // A limit the service has just reached: the next request is over it.
    const { rows } = await pool.query(
      `select count(*)::int as used from public.ai_usage where created_at > now() - interval '24 hours'`,
    );
    const used: number = rows[0].used;
    expect(await ask(used)).toEqual({ kind: 'paused' });
    expect(requests).toHaveLength(0);
    // A refused request is not held against the learner.
    expect((await quotaFor(pool, USER, 'tutor', new Date())).remaining).toBe(15);

    await pool.query(
      `insert into public.subscriptions (user_id, plan, status, provider) values ($1, 'pro_monthly', 'active', 'manual')`,
      [USER],
    );
    // Pro keeps working past the limit, up to twice it.
    const paid = await ask(used);
    expect(paid.kind).toBe('stream');
    await read((paid as { stream: ReadableStream<Uint8Array> }).stream);
    expect(await ask(Math.floor(used / 2))).toEqual({ kind: 'paused' });
    await pool.query('delete from public.subscriptions where user_id = $1', [USER]);
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

  it('explains only questions the learner’s plan lets them study', async () => {
    await pool.query('delete from public.ai_usage where user_id = $1', [USER]);
    await pool.query('delete from public.subscriptions where user_id = $1', [USER]);
    // More questions than the Free plan's sample holds.
    for (let n = 0; n < FREE_QUESTIONS_PER_COUNTRY + 2; n += 1) {
      await insertQuestion('published', `Zusatzfrage Nummer ${n}`);
    }
    const { rows } = await pool.query<{ id: string; topicId: string }>(
      `select id, topic_id as "topicId" from public.questions
       where country_code = $1 and status = 'published'`,
      [COUNTRY],
    );
    const free = freeQuestionIds(rows);
    const locked = rows.find((row) => !free.has(row.id))!.id;
    const sampled = rows.find((row) => free.has(row.id) && row.id !== questionId)!.id;

    const { generator, requests } = fakeGenerator();
    expect(await explain(pool, generator, USER, locked)).toEqual({ kind: 'unavailable' });
    expect(requests).toHaveLength(0);
    const inSample = await explain(pool, generator, USER, sampled);
    expect(inSample.kind).toBe('stream');
    await read((inSample as { stream: ReadableStream<Uint8Array> }).stream);

    await pool.query(
      `insert into public.subscriptions (user_id, plan, status, provider) values ($1, 'pro_monthly', 'active', 'manual')`,
      [USER],
    );
    const withPro = await explain(pool, generator, USER, locked);
    expect(withPro.kind).toBe('stream');
    await read((withPro as { stream: ReadableStream<Uint8Array> }).stream);
  });
});
