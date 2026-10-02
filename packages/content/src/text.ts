import { createHash } from 'node:crypto';

export function sha256(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Unicode-normalised, with every run of whitespace collapsed to one space. */
export function normalizeText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Hash of the text that ignores layout: re-wrapping a document does not change it. */
export function hashText(text: string): string {
  return sha256(normalizeText(text));
}

export interface Passage {
  ordinal: number;
  heading: string | null;
  text: string;
  contentHash: string;
}

export interface SplitOptions {
  /** Passages are closed once they reach this size, at the next block boundary. */
  targetChars?: number;
  /** No passage is longer than this; oversized blocks are cut at sentence ends. */
  maxChars?: number;
}

const HEADING_MAX_CHARS = 90;

function looksLikeHeading(block: string): boolean {
  if (block.length > HEADING_MAX_CHARS || block.includes('\n')) return false;
  if (/[.!?:;,]$/.test(block)) return false;
  // At least one letter, and not a bare page number or list marker.
  return /\p{L}/u.test(block) && block.split(/\s+/).length <= 12;
}

function splitLongBlock(block: string, maxChars: number): string[] {
  if (block.length <= maxChars) return [block];
  const sentences = block.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [block];
  const pieces: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > maxChars) {
      pieces.push(current.trim());
      current = '';
    }
    current += sentence;
    // A single "sentence" longer than the limit (a table, a list) is cut hard.
    while (current.length > maxChars) {
      pieces.push(current.slice(0, maxChars).trim());
      current = current.slice(maxChars);
    }
  }
  if (current.trim()) pieces.push(current.trim());
  return pieces;
}

/**
 * Splits a document into passages small enough to cite and to review side by
 * side with a question. Blocks are paragraphs (separated by blank lines); a
 * short line with no closing punctuation is treated as a heading and starts a
 * new passage.
 */
export function splitIntoPassages(text: string, options: SplitOptions = {}): Passage[] {
  const targetChars = options.targetChars ?? 1800;
  const maxChars = options.maxChars ?? 3500;

  const blocks = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .replace(/[ \t]+/g, ' ')
        .replace(/ ?\n ?/g, '\n')
        .trim(),
    )
    .filter(Boolean);

  const passages: Passage[] = [];
  let heading: string | null = null;
  let parts: string[] = [];
  let size = 0;

  const close = () => {
    const body = parts.join('\n\n').trim();
    if (body) {
      passages.push({
        ordinal: passages.length,
        heading,
        text: body,
        contentHash: hashText(body),
      });
    }
    parts = [];
    size = 0;
  };

  for (const block of blocks) {
    if (looksLikeHeading(block)) {
      close();
      heading = normalizeText(block);
      continue;
    }
    for (const piece of splitLongBlock(block, maxChars)) {
      if (size > 0 && size + piece.length > maxChars) close();
      parts.push(piece);
      size += piece.length;
      if (size >= targetChars) close();
    }
  }
  close();
  return passages;
}

const QUOTE_CLASSES: [RegExp, string][] = [
  [/['\u2018\u2019\u201A\u2032]/, "['\\u2018\\u2019\\u201A\\u2032]"],
  [/["\u201C\u201D\u201E\u2033]/, '["\\u201C\\u201D\\u201E\\u2033]'],
  [/[-\u2010-\u2015\u2212]/, '[-\\u2010-\\u2015\\u2212]'],
];

/**
 * Where `quote` sits in `passage`, or null if it is not there. Differences of
 * case, line breaks, and quote or dash style are forgiven; different words are not.
 */
export function locateQuote(passage: string, quote: string): { start: number; end: number } | null {
  const wanted = quote.normalize('NFC').trim();
  if (!wanted) return null;
  let pattern = '';
  for (const part of wanted.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      pattern += '\\s+';
      continue;
    }
    for (const char of part) {
      const tolerant = QUOTE_CLASSES.find(([matcher]) => matcher.test(char));
      pattern += tolerant ? tolerant[1] : char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  const match = new RegExp(pattern, 'iu').exec(passage.normalize('NFC'));
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

/**
 * True if `quote` really appears in `passage`. This is the guard against a
 * model inventing its citation.
 */
export function quoteAppearsIn(passage: string, quote: string): boolean {
  return locateQuote(passage, quote) !== null;
}

/** `lowercase-with-hyphens`, ASCII only, for topic slugs. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
