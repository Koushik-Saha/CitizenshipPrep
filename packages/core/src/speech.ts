// Checking an answer given aloud. A speech recogniser hands over what it
// thinks it heard, often with small mistakes and extra words ("it's the
// Constitution"); this decides which of a question's options, if any, that
// was. Pure text comparison, so it works offline and in any language.

/** The words for one to ten, by language, so "two" and "2" are the same answer. */
const numberWords: Record<string, readonly string[]> = {
  en: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
  es: ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'],
  fr: ['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'],
  pt: ['um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'],
  de: ['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'],
  hi: ['एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ', 'दस'],
  bn: ['এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ'],
  ar: ['واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'],
  zh: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'],
  tl: ['isa', 'dalawa', 'tatlo', 'apat', 'lima', 'anim', 'pito', 'walo', 'siyam', 'sampu'],
  vi: ['một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'],
};

/** Where each script's digits start: Latin, Arabic, Persian, Devanagari, Bengali, full-width. */
const digitZeros = [0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xff10];

/** Lower case, without accents, vowel marks or punctuation, and with every script's digits as 0-9. */
function fold(text: string, locale: string): string {
  return (
    text
      .normalize('NFD')
      // Latin accents and Arabic vowel marks: optional in writing, absent from most transcripts.
      .replace(/[̀-ًͯ-ْٰ]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .normalize('NFC')
      .toLocaleLowerCase(locale)
      .replace(/\p{Nd}/gu, (digit) => {
        const code = digit.codePointAt(0)!;
        const zero = digitZeros.find((start) => code >= start && code < start + 10);
        return zero === undefined ? digit : String(code - zero);
      })
      // "D.C." and "it's" are one word each; any other punctuation separates words.
      .replace(/[.'’]/g, '')
      .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
      .trim()
  );
}

const unspaced = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;

/**
 * The words of a phrase, ready to compare: folded (see above), number words
 * as digits, and scripts written without spaces taken a character at a time.
 */
export function spokenTokens(text: string, locale: string): string[] {
  const language = locale.split('-')[0]!.toLowerCase();
  const words = (numberWords[language] ?? []).map((word) => fold(word, locale));
  return fold(text, locale)
    .split(' ')
    .flatMap((token) => (unspaced.test(token) ? [...token] : [token]))
    .filter((token) => token !== '')
    .map((token) => {
      const value = words.indexOf(token);
      return value === -1 ? token : String(value + 1);
    });
}

/** Edit distance, given up on once it passes `limit`. */
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row.push(
        Math.min(
          previous[j]! + 1,
          row[j - 1]! + 1,
          previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
        ),
      );
    }
    previous = row;
  }
  return previous[b.length]!;
}

/** The same word, allowing a recogniser's slip in a long one ("Jeferson"). Numbers must match exactly. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter < 5 || /\d/.test(a + b)) return false;
  const allowed = shorter >= 9 ? 2 : 1;
  return distance(a, b, allowed) <= allowed;
}

/** How much of `wanted` is in `given`, counting long words for more than short ones. */
function share(wanted: readonly string[], given: readonly string[]): number {
  const weight = (tokens: readonly string[]) =>
    tokens.reduce((sum, token) => sum + token.length, 0);
  const found = wanted.filter((token) => given.some((other) => sameWord(token, other)));
  return wanted.length === 0 ? 0 : weight(found) / weight(wanted);
}

export interface SpokenOption {
  key: string;
  text: string;
}

export type SpokenAnswer =
  /** Clearly one of the options. */
  | { kind: 'option'; key: string }
  /** Something was said, but it is not clearly any one option. */
  | { kind: 'unmatched' }
  /** Nothing usable was heard. */
  | { kind: 'silence' };

/** The least of an option's words that must be heard, by length. */
const ENOUGH = 0.75;
/** How far ahead of the next-best option the best must be. */
const CLEAR_LEAD = 0.1;

function matchOne(
  heard: readonly string[],
  options: readonly { key: string; tokens: string[] }[],
  byPosition: boolean,
): string | null {
  // Said exactly: wins outright, even where one option contains another
  // ("Washington" and "Washington, D.C.").
  const exact = options.filter((option) => option.tokens.join(' ') === heard.join(' '));
  if (exact.length === 1) return exact[0]!.key;

  // "Two", "number two", "option 2": the choice by its place in the list.
  const numbers = heard.filter((token) => /^\d+$/.test(token));
  if (byPosition && numbers.length === 1 && heard.length <= 3) {
    const place = Number(numbers[0]);
    if (place >= 1 && place <= options.length) return options[place - 1]!.key;
  }

  const scored = options
    .map((option) => {
      const recall = share(option.tokens, heard);
      return { key: option.key, recall, score: 0.7 * recall + 0.3 * share(heard, option.tokens) };
    })
    .sort((a, b) => b.score - a.score);
  const [best, next] = scored;
  if (!best || best.recall < ENOUGH) return null;
  return next && best.score - next.score < CLEAR_LEAD ? null : best.key;
}

/**
 * Which option a spoken answer was. `heard` is what the recogniser returned,
 * most likely first: the first reading that clearly matches an option wins.
 *
 * With `byPosition`, a bare number is taken as the choice's place in the
 * list, for when the choices were read out numbered. Leave it off where no
 * list was read (an interview).
 */
export function matchSpokenAnswer(
  heard: readonly string[],
  options: readonly SpokenOption[],
  locale: string,
  settings: { byPosition: boolean },
): SpokenAnswer {
  const choices = options.map((option) => ({
    key: option.key,
    tokens: spokenTokens(option.text, locale),
  }));
  const readings = heard
    .map((reading) => spokenTokens(reading, locale))
    .filter((tokens) => tokens.length > 0);
  for (const reading of readings) {
    const key = matchOne(reading, choices, settings.byPosition);
    if (key !== null) return { kind: 'option', key };
  }
  return { kind: readings.length > 0 ? 'unmatched' : 'silence' };
}
