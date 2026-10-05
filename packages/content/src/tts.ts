import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

// Text to speech for the audio pipeline. A Speaker turns a piece of text in
// a language into a recording; which service does it is a setting.

export interface Recording {
  data: Uint8Array;
  contentType: string;
  /** Who read it, for the record: the service and its voice. */
  voice: string;
}

export interface SpeakRequest {
  text: string;
  /** The text's language, as the app writes it: "es", "zh-Hans". */
  locale: string;
  /** The country whose exam this is, to pick an accent where there is a choice. */
  countryCode?: string;
}

export interface Speaker {
  /** The service's name, for messages. */
  readonly name: string;
  speak(request: SpeakRequest): Promise<Recording>;
}

/** The service has no voice for this language: not a failure, just nothing to record. */
export class NoVoiceError extends Error {
  override readonly name = 'NoVoiceError';
}

// Speech services want a language and a region ("es-ES"). The app's study
// languages mostly have neither a region nor one obvious accent, so: a
// default per language, and the exam's own country where the service has
// that accent.
const defaultRegion: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  pl: 'pl-PL',
  ro: 'ro-RO',
  uk: 'uk-UA',
  ru: 'ru-RU',
  tr: 'tr-TR',
  ar: 'ar-XA',
  ur: 'ur-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  pa: 'pa-IN',
  gu: 'gu-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  'zh-Hans': 'cmn-CN',
  'zh-Hant': 'cmn-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  vi: 'vi-VN',
  tl: 'fil-PH',
  am: 'am-ET',
  sw: 'sw-KE',
};

const accents: Record<string, readonly string[]> = {
  en: ['US', 'GB', 'AU', 'IN'],
  es: ['ES', 'US'],
  fr: ['FR', 'CA'],
  pt: ['BR', 'PT'],
};

/** The language tag to ask a speech service for, or null if we know of no voice. */
export function speechLanguage(locale: string, countryCode?: string): string | null {
  const fallback = defaultRegion[locale] ?? defaultRegion[locale.split('-')[0]!];
  if (!fallback) return null;
  const language = fallback.split('-')[0]!;
  const country = countryCode?.toUpperCase();
  return country && accents[language]?.includes(country) ? `${language}-${country}` : fallback;
}

/**
 * Google Cloud Text-to-Speech, which has a voice for nearly every study
 * language. Needs an API key with the Text-to-Speech API enabled.
 */
export function createGoogleSpeaker(options: {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
}): Speaker {
  const send = options.fetch ?? globalThis.fetch;
  return {
    name: 'Google Cloud Text-to-Speech',
    async speak({ text, locale, countryCode }) {
      const languageCode = speechLanguage(locale, countryCode);
      if (!languageCode) throw new NoVoiceError(`No voice is set up for "${locale}".`);
      const response = await send('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': options.apiKey },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        // The service answers 400 for a language it has no voice in.
        if (response.status === 400 && /voice|language/i.test(detail)) {
          throw new NoVoiceError(`The service has no voice for ${languageCode}.`);
        }
        throw new Error(`Text-to-speech failed (${response.status}): ${detail}`);
      }
      const body = (await response.json()) as { audioContent?: string };
      if (!body.audioContent) throw new Error('Text-to-speech returned no audio.');
      return {
        data: new Uint8Array(Buffer.from(body.audioContent, 'base64')),
        contentType: 'audio/mpeg',
        voice: `google:${languageCode}`,
      };
    },
  };
}

const run = promisify(execFile);

/** Clear, ordinary English voices that ship with macOS, ahead of its many novelty ones. */
const plainEnglish = ['Samantha', 'Daniel', 'Karen', 'Rishi'];

/**
 * The voices built into macOS (`say`), for trying the audio pipeline on a
 * developer's machine without an account anywhere. Not for production: the
 * voices are Apple's, and only the ones installed on that Mac exist.
 */
export function createMacSpeaker(): Speaker {
  let voices: Promise<{ name: string; tag: string }[]> | undefined;
  const installed = () =>
    (voices ??= run('say', ['-v', '?']).then(({ stdout }) =>
      stdout.split('\n').flatMap((line) => {
        // "Eddy (Spanish (Spain)) es_ES    # ¡Hola! Me llamo Eddy."
        const match = /^(.+?)\s+([a-z]{2,3}_[A-Z0-9]{2,3})\s+#/.exec(line);
        return match ? [{ name: match[1]!.trim(), tag: match[2]!.replace('_', '-') }] : [];
      }),
    ));
  // `say` hangs when several run at once, so they take turns.
  let turn: Promise<unknown> = Promise.resolve();

  async function record(voice: string, text: string): Promise<Uint8Array> {
    const folder = await mkdtemp(join(tmpdir(), 'oathly-say-'));
    try {
      const file = join(folder, 'clip.m4a');
      await run('say', ['-v', voice, '-o', file, '--file-format=m4af', '--data-format=aac', text], {
        timeout: 60_000,
      });
      return new Uint8Array(await readFile(file));
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  return {
    name: 'macOS voices (development)',
    async speak({ text, locale, countryCode }) {
      const wanted = (speechLanguage(locale, countryCode) ?? locale).replace(/^cmn-/, 'zh-');
      const language = wanted.split('-')[0]!;
      const all = (await installed())
        .filter((candidate) => candidate.tag.split('-')[0] === language)
        // The names in brackets are the same few synthetic voices in every language.
        .sort(
          (a, b) =>
            Number(b.tag === wanted) - Number(a.tag === wanted) ||
            Number(plainEnglish.includes(b.name)) - Number(plainEnglish.includes(a.name)) ||
            Number(a.name.includes('(')) - Number(b.name.includes('(')),
        );
      const voice = all[0];
      if (!voice) throw new NoVoiceError(`This Mac has no voice for "${locale}".`);
      const mine = turn.then(() => record(voice.name, text));
      turn = mine.catch(() => {});
      return { data: await mine, contentType: 'audio/mp4', voice: `macos:${voice.name}` };
    },
  };
}

/**
 * The speaker the environment asks for: TTS_PROVIDER is "google" (needs
 * GOOGLE_TTS_API_KEY) or "macos". Unset, it is Google when a key is present.
 */
export function createSpeaker(env: NodeJS.ProcessEnv = process.env): Speaker {
  const provider =
    env.TTS_PROVIDER?.trim().toLowerCase() || (env.GOOGLE_TTS_API_KEY ? 'google' : '');
  if (provider === 'macos') return createMacSpeaker();
  if (provider === 'google') {
    if (!env.GOOGLE_TTS_API_KEY) {
      throw new Error(
        'GOOGLE_TTS_API_KEY is not set. Add it to .env.local at the repository root.',
      );
    }
    return createGoogleSpeaker({ apiKey: env.GOOGLE_TTS_API_KEY });
  }
  throw new Error(
    provider
      ? `Unknown TTS_PROVIDER "${provider}". Use "google" or "macos".`
      : 'No text-to-speech service is set up. Add GOOGLE_TTS_API_KEY to .env.local, or set TTS_PROVIDER=macos to try it with this Mac’s voices.',
  );
}
