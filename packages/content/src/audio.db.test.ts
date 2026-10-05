import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPool } from './db';
import { clipId, recordAudio } from './pipeline/audio';
import { NoVoiceError, type Speaker, type SpeakRequest } from './tts';

// Records clips into a real database with a stand-in for the speech service.
// A clip is named by its words, and other packages' tests share this database,
// so every text here is one no other test uses.
// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;

// A made-up country code that no other package's tests use: they share this database.
const COUNTRY = 'ZT';
const REVIEWER = 'test:audio-reviewer';

/** "Reads" a text by returning its bytes, and remembers what it was asked. */
function fakeSpeaker(): Speaker & { asked: SpeakRequest[] } {
  const asked: SpeakRequest[] = [];
  return {
    name: 'fake',
    asked,
    speak(request) {
      asked.push(request);
      if (request.locale === 'so') return Promise.reject(new NoVoiceError('No Somali voice.'));
      if (request.text.includes('broken')) return Promise.reject(new Error('The service is down.'));
      return Promise.resolve({
        data: new TextEncoder().encode(`spoken:${request.text}`),
        contentType: 'audio/mpeg',
        voice: `fake:${request.locale}`,
      });
    },
  };
}

describe.skipIf(!url)('recording audio (needs the local database)', () => {
  let pool: pg.Pool;
  const ids: Record<string, string> = {};

  const cleanUp = async () => {
    await pool.query('delete from public.audio_clips where voice like $1', ['fake:%']);
    // Questions first: a country cannot be deleted while it has any.
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
    await pool.query('delete from public.profiles where id = $1', [REVIEWER]);
  };

  async function addQuestion(name: string, status: 'published' | 'draft', text: string) {
    const id = (
      await pool.query<{ id: string }>(
        `insert into public.questions
           (country_code, topic_id, difficulty, type, correct_answer, source_url, status, verified_by, last_verified_at)
         select $1, t.id, 1, 'multiple_choice', '{"keys": ["a"]}', 'https://example.test', $2::public.question_status,
                case when $2 = 'published' then $3 end, case when $2 = 'published' then now() end
         from public.topics t where t.country_code = $1
         returning id`,
        [COUNTRY, status, REVIEWER],
      )
    ).rows[0]!.id;
    ids[name] = id;
    await addWording(name, 'en', text, null, 'approved');
  }

  async function addWording(
    name: string,
    locale: string,
    text: string,
    from: string | null,
    status: 'approved' | 'draft',
  ) {
    await pool.query(
      `insert into public.question_translations
         (question_id, locale, text, options, explanation, translated_from, status, reviewed_by, reviewed_at)
       values ($1, $2, $3, '[{"key":"a","text":"Audioland yes"},{"key":"b","text":"Audioland no"}]', $4, $5, $6::public.translation_status,
               case when $6 = 'approved' then $7 end, case when $6 = 'approved' then now() end)`,
      [ids[name], locale, text, `Because: ${text}`, from, status, REVIEWER],
    );
  }

  beforeAll(async () => {
    pool = createPool(url);
    await cleanUp();
    await pool.query('insert into public.profiles (id, display_name) values ($1, $2)', [
      REVIEWER,
      'Audio Reviewer',
    ]);
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages) values ($1, 'Audioland', true, '{en}')`,
      [COUNTRY],
    );
    await pool.query(
      `insert into public.topics (country_code, slug, name) values ($1, 'civics', 'Civics')`,
      [COUNTRY],
    );
    await addQuestion('first', 'published', 'Is this the first question?');
    await addQuestion('second', 'published', 'Is this the second question?');
    await addQuestion('unpublished', 'draft', 'Is this a draft?');
    await addWording('first', 'es', '¿Es esta la primera pregunta?', 'en', 'approved');
    await addWording('second', 'es', '¿Borrador?', 'en', 'draft');
    await addWording('second', 'so', 'Su’aashan ma labaad baa?', 'en', 'approved');
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  const only = { countryCode: COUNTRY };

  it('works out what is missing without recording on a dry run', async () => {
    const speaker = fakeSpeaker();
    const summary = await recordAudio(pool, speaker, { ...only, dryRun: true });
    // English: 2 questions, 2 explanations, and the choices and the answer once each
    // (both questions share them).
    // Spanish: a question, an explanation, the choices and the answer.
    // Somali: a question and an explanation, the choices and the answer.
    expect(summary).toMatchObject({ needed: 14, existing: 0, recorded: 0, remaining: 14 });
    expect(speaker.asked).toEqual([]);
  });

  it('records published questions in their approved languages, once per text', async () => {
    const speaker = fakeSpeaker();
    const summary = await recordAudio(pool, speaker, only);
    expect(summary).toMatchObject({
      needed: 14,
      existing: 0,
      recorded: 10,
      remaining: 4,
      noVoice: ['so'],
      failed: [],
    });
    expect(summary.characters).toBeGreaterThan(0);

    const texts = speaker.asked.map((request) => request.text);
    expect(texts).toContain('Is this the first question?');
    expect(texts).toContain('1. Audioland yes\n2. Audioland no');
    expect(texts).toContain('¿Es esta la primera pregunta?');
    // Neither the draft question nor the draft translation.
    expect(texts.some((text) => text.includes('draft') || text.includes('Borrador'))).toBe(false);
    // The exam's country comes along, for the accent.
    expect(speaker.asked.every((request) => request.countryCode === COUNTRY)).toBe(true);

    const stored = await pool.query<{ voice: string; content_type: string; data: Buffer }>(
      'select voice, content_type, data from public.audio_clips where id = $1',
      [clipId('en', 'Is this the first question?')],
    );
    expect(stored.rows[0]).toMatchObject({ voice: 'fake:en', content_type: 'audio/mpeg' });
    expect(stored.rows[0]!.data.toString()).toBe('spoken:Is this the first question?');
  });

  it('records nothing the second time, and only the change after an edit', async () => {
    const again = fakeSpeaker();
    const summary = await recordAudio(pool, again, { ...only, locales: ['en', 'es'] });
    expect(summary).toMatchObject({ needed: 10, existing: 10, recorded: 0, remaining: 0 });
    expect(again.asked).toEqual([]);

    await pool.query(
      `update public.question_translations set text = 'Is this the first question, reworded?'
       where question_id = $1 and locale = 'en'`,
      [ids.first],
    );
    const edited = fakeSpeaker();
    expect(await recordAudio(pool, edited, { ...only, locales: ['en'] })).toMatchObject({
      recorded: 1,
    });
    expect(edited.asked.map((request) => request.text)).toEqual([
      'Is this the first question, reworded?',
    ]);
  });

  it('stops at the limit, and reports what the service could not do', async () => {
    await addQuestion('third', 'published', 'Is this one broken?');
    const limited = fakeSpeaker();
    const first = await recordAudio(pool, limited, { ...only, locales: ['en'], limit: 1 });
    expect(first.recorded + first.failed.length).toBe(1);
    expect(first.remaining).toBeGreaterThanOrEqual(1);

    const rest = await recordAudio(pool, fakeSpeaker(), { ...only, locales: ['en'] });
    expect(rest.failed.map((failure) => failure.error)).toContain('The service is down.');
    // What failed is still to do, and is tried again next time.
    expect(rest.remaining).toBe(rest.failed.length);
  });

  it('prunes only on a whole-library run', async () => {
    await expect(recordAudio(pool, fakeSpeaker(), { ...only, prune: true })).rejects.toThrow(
      '--prune looks at the whole library',
    );
    // The reworded question's old clip is no longer needed by anything.
    const stale = clipId('en', 'Is this the first question?');
    const before = await pool.query('select 1 from public.audio_clips where id = $1', [stale]);
    expect(before.rowCount).toBe(1);
    // Pruning looks at every country, so this run records nothing (limit 0):
    // other packages' tests share this database and must not find clips they did not make.
    const summary = await recordAudio(pool, fakeSpeaker(), { prune: true, limit: 0 });
    expect(summary.pruned).toBeGreaterThanOrEqual(1);
    const after = await pool.query('select 1 from public.audio_clips where id = $1', [stale]);
    expect(after.rowCount).toBe(0);
  });
});
