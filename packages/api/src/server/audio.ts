import { createHash } from 'node:crypto';

import { clipKey, clipParts, clipTexts, type QuestionType } from '@oathly/core';
import type pg from 'pg';

import type { QuestionWording, SessionQuestion, WordingAudio } from '../study';

// Audio mode on the server: which recorded clips a question has, and the
// clips themselves. Clips are made ahead of time by the content pipeline
// (`pnpm content audio`) and named by a hash of their language and words, so
// "does this wording have audio?" is "do rows with these names exist?".

type Db = Pick<pg.Pool, 'query'>;

/** A wording nothing has been recorded for. */
export const noAudio: WordingAudio = {
  question: null,
  options: null,
  answer: null,
  explanation: null,
};

/** The name of the clip for some words in a language. */
export function clipId(locale: string, text: string): string {
  return createHash('sha256').update(clipKey(locale, text)).digest('hex');
}

/** The clips a wording would use, whether or not they have been recorded. */
function wantedClips(
  wording: Omit<QuestionWording, 'audio'>,
  question: { type: QuestionType; correctKeys: readonly string[] },
): WordingAudio {
  const texts = clipTexts({ ...wording, type: question.type, correctKeys: question.correctKeys });
  const wanted = { ...noAudio };
  for (const part of clipParts) {
    const text = texts[part];
    if (text !== null) wanted[part] = clipId(wording.locale, text);
  }
  return wanted;
}

/**
 * Fills in `audio` on each question, and on its exam-language wording: the
 * id of each recorded clip, or null where there is none (the app then reads
 * that part with the device's own voice).
 */
export async function attachAudio<T extends SessionQuestion>(db: Db, questions: T[]): Promise<T[]> {
  const wanted = questions.map((question) => ({
    own: wantedClips(question, question),
    original: question.original ? wantedClips(question.original, question) : null,
  }));
  const ids = [
    ...new Set(
      wanted
        .flatMap((entry) => [entry.own, entry.original])
        .flatMap((audio) => (audio ? Object.values(audio) : []))
        .filter((id) => id !== null),
    ),
  ];
  if (ids.length === 0) return questions;
  const recorded = new Set(
    (
      await db.query<{ id: string }>('select id from public.audio_clips where id = any($1)', [ids])
    ).rows.map((row) => row.id),
  );
  const only = (audio: WordingAudio): WordingAudio =>
    Object.fromEntries(
      clipParts.map((part) => [
        part,
        audio[part] && recorded.has(audio[part]) ? audio[part] : null,
      ]),
    ) as WordingAudio;
  return questions.map((question, index) => ({
    ...question,
    audio: only(wanted[index]!.own),
    original: question.original
      ? { ...question.original, audio: only(wanted[index]!.original!) }
      : null,
  }));
}

export interface AudioClip {
  contentType: string;
  data: Buffer;
}

/** A recorded clip by id, or null. Ids are public: they reveal nothing and cannot be guessed. */
export async function getAudioClip(db: Db, id: string): Promise<AudioClip | null> {
  if (!/^[0-9a-f]{64}$/.test(id)) return null;
  const { rows } = await db.query<{ content_type: string; data: Buffer }>(
    'select content_type, data from public.audio_clips where id = $1',
    [id],
  );
  return rows[0] ? { contentType: rows[0].content_type, data: rows[0].data } : null;
}

/**
 * The part of a file an HTTP Range header asks for ("bytes=0-99", "bytes=100-",
 * "bytes=-50"): null for no usable header (send it all), or "unsatisfiable"
 * when the range lies outside the file. Only a single range is honoured.
 */
export function byteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '');
  if (!match || (match[1] === '' && match[2] === '')) return null;
  if (match[1] === '') {
    // The last N bytes.
    const length = Number(match[2]);
    return length === 0 ? 'unsatisfiable' : { start: Math.max(0, size - length), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  return start >= size || start > end ? 'unsatisfiable' : { start, end };
}
