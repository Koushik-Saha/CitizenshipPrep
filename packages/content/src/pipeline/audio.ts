import { createHash } from 'node:crypto';

import { clipKey, clipParts, clipTexts, type QuestionType } from '@oathly/core';

import type { Db } from '../db';
import { NoVoiceError, type Speaker } from '../tts';

// Records the clips audio mode plays: for every published question, in every
// language it has an approved wording in, the question, its choices, its
// answer and its explanation. A clip is named by a hash of its language and
// words, so running this again only records what is new or has changed.

export interface AudioOptions {
  /** Only this country's questions. */
  countryCode?: string;
  /** Only these languages. */
  locales?: string[];
  /** The most clips to record in one run, to keep a first run's bill in hand. */
  limit?: number;
  /** Work out what is missing without recording anything. */
  dryRun?: boolean;
  /** Delete clips no published question needs any more. Whole-library runs only. */
  prune?: boolean;
  /** How many clips to record at once. */
  concurrency?: number;
  log?: (message: string) => void;
}

export interface AudioSummary {
  /** Clips the published questions need. */
  needed: number;
  /** Of those, already recorded before this run. */
  existing: number;
  recorded: number;
  /** Characters sent to the speech service: what it bills by. */
  characters: number;
  /** Still to do: over the limit, or a dry run. */
  remaining: number;
  /** Languages the service has no voice for; the apps use the device's voice instead. */
  noVoice: string[];
  failed: { locale: string; text: string; error: string }[];
  pruned: number;
}

interface WantedClip {
  id: string;
  locale: string;
  text: string;
  countryCode: string;
}

/** The name of the clip for some words in a language. */
export function clipId(locale: string, text: string): string {
  return createHash('sha256').update(clipKey(locale, text)).digest('hex');
}

async function wantedClips(db: Db, options: AudioOptions): Promise<Map<string, WantedClip>> {
  const { rows } = await db.query<{
    country_code: string;
    type: QuestionType;
    correct_answer: { keys: string[] };
    locale: string;
    text: string;
    options: { key: string; text: string }[];
    explanation: string | null;
  }>(
    `select q.country_code, q.type, q.correct_answer, tr.locale, tr.text, tr.options, tr.explanation
     from public.questions q
     join public.question_translations tr on tr.question_id = q.id and tr.status = 'approved'
     where q.status = 'published'
       and ($1::text is null or q.country_code = $1)
       and ($2::text[] is null or tr.locale = any($2))
     order by q.country_code, q.id, tr.locale`,
    [options.countryCode ?? null, options.locales?.length ? options.locales : null],
  );
  const wanted = new Map<string, WantedClip>();
  for (const row of rows) {
    const texts = clipTexts({
      type: row.type,
      text: row.text,
      options: row.options,
      correctKeys: row.correct_answer.keys,
      explanation: row.explanation,
    });
    for (const part of clipParts) {
      const text = texts[part];
      if (text === null) continue;
      const id = clipId(row.locale, text);
      if (!wanted.has(id)) {
        wanted.set(id, { id, locale: row.locale, text, countryCode: row.country_code });
      }
    }
  }
  return wanted;
}

/** Runs `work` over `items`, `width` at a time. */
async function inParallel<T>(items: T[], width: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(width, items.length) }, async () => {
      while (next < items.length) await work(items[next++]!);
    }),
  );
}

export async function recordAudio(
  db: Db,
  speaker: Speaker,
  options: AudioOptions = {},
): Promise<AudioSummary> {
  const log = options.log ?? (() => {});
  const narrowed = Boolean(options.countryCode || options.locales?.length);
  if (options.prune && narrowed) {
    throw new Error('--prune looks at the whole library: run it without --country or --locales.');
  }

  const wanted = await wantedClips(db, options);
  const ids = [...wanted.keys()];
  const existing = new Set(
    (
      await db.query<{ id: string }>('select id from public.audio_clips where id = any($1)', [ids])
    ).rows.map((row) => row.id),
  );
  const missing = ids.filter((id) => !existing.has(id)).map((id) => wanted.get(id)!);
  const batch = options.dryRun ? [] : missing.slice(0, options.limit ?? missing.length);

  const summary: AudioSummary = {
    needed: ids.length,
    existing: existing.size,
    recorded: 0,
    characters: 0,
    remaining: missing.length,
    noVoice: [],
    failed: [],
    pruned: 0,
  };
  const noVoice = new Set<string>();

  await inParallel(batch, options.concurrency ?? 4, async (clip) => {
    // One refusal is enough to know a language has no voice.
    if (noVoice.has(clip.locale)) return;
    try {
      const recording = await speaker.speak({
        text: clip.text,
        locale: clip.locale,
        countryCode: clip.countryCode,
      });
      await db.query(
        `insert into public.audio_clips (id, locale, voice, char_count, content_type, byte_size, data)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do nothing`,
        [
          clip.id,
          clip.locale,
          recording.voice,
          clip.text.length,
          recording.contentType,
          recording.data.byteLength,
          Buffer.from(recording.data),
        ],
      );
      summary.recorded += 1;
      summary.characters += clip.text.length;
      summary.remaining -= 1;
      if (summary.recorded % 25 === 0) log(`Recorded ${summary.recorded} of ${batch.length}…`);
    } catch (error) {
      if (error instanceof NoVoiceError) {
        noVoice.add(clip.locale);
        log(`${error.message} Skipping ${clip.locale}.`);
        return;
      }
      summary.failed.push({
        locale: clip.locale,
        text: clip.text.slice(0, 60),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
  summary.noVoice = [...noVoice].sort();

  if (options.prune && !options.dryRun) {
    const pruned = await db.query('delete from public.audio_clips where not (id = any($1))', [ids]);
    summary.pruned = pruned.rowCount ?? 0;
  }
  return summary;
}
