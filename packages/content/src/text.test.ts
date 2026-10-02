import { describe, expect, it } from 'vitest';

import {
  hashText,
  locateQuote,
  normalizeText,
  quoteAppearsIn,
  slugify,
  splitIntoPassages,
} from './text';

describe('hashText', () => {
  it('ignores layout but not words', () => {
    expect(hashText('The  Constitution\nis the supreme law.')).toBe(
      hashText('The Constitution is the supreme law.'),
    );
    expect(hashText('The Constitution is the supreme law.')).not.toBe(
      hashText('The Constitution was the supreme law.'),
    );
  });

  it('treats composed and decomposed accents as the same text', () => {
    expect(normalizeText('Einbürgerung')).toBe('Einbürgerung');
  });
});

describe('splitIntoPassages', () => {
  const paragraph = (label: string, length: number) =>
    `${label} ${'word '.repeat(Math.ceil(length / 5))}`.slice(0, length).trim() + '.';

  it('starts a new passage at each heading and remembers it', () => {
    const passages = splitIntoPassages(
      [
        'System of Government',
        paragraph('First', 300),
        'Rights and Responsibilities',
        paragraph('Second', 300),
      ].join('\n\n'),
    );
    expect(passages.map((passage) => passage.heading)).toEqual([
      'System of Government',
      'Rights and Responsibilities',
    ]);
    expect(passages.map((passage) => passage.ordinal)).toEqual([0, 1]);
    expect(passages[0]!.text.startsWith('First')).toBe(true);
  });

  it('groups short paragraphs and closes a passage once it reaches the target', () => {
    const text = Array.from({ length: 6 }, (_, i) => paragraph(`P${i}`, 400)).join('\n\n');
    const passages = splitIntoPassages(text, { targetChars: 1000, maxChars: 2000 });
    expect(passages).toHaveLength(2);
    expect(passages.every((passage) => passage.text.length <= 2000)).toBe(true);
  });

  it('cuts an oversized block at sentence ends, never above the limit', () => {
    const block = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} says something.`).join(
      ' ',
    );
    const passages = splitIntoPassages(block, { targetChars: 300, maxChars: 400 });
    expect(passages.length).toBeGreaterThan(2);
    for (const passage of passages) {
      expect(passage.text.length).toBeLessThanOrEqual(400);
      expect(passage.text.endsWith('.')).toBe(true);
    }
  });

  it('gives identical text the same hash wherever it sits', () => {
    const [first] = splitIntoPassages(paragraph('Same', 300));
    const [, second] = splitIntoPassages(
      `A Heading\n\nOther text here.\n\nNext Heading\n\n${paragraph('Same', 300)}`,
    );
    expect(second!.contentHash).toBe(first!.contentHash);
  });

  it('returns nothing for an empty document', () => {
    expect(splitIntoPassages('  \n\n \n')).toEqual([]);
  });
});

describe('quoteAppearsIn', () => {
  const passage =
    'The Constitution is the “supreme law of the land”.\nIt was written in 1787 – in Philadelphia.';

  it('accepts a verbatim quote despite line breaks, case and quote style', () => {
    expect(quoteAppearsIn(passage, 'the constitution is the "supreme law of the land".')).toBe(
      true,
    );
    expect(quoteAppearsIn(passage, 'It was written in 1787 - in Philadelphia.')).toBe(true);
  });

  it('rejects a paraphrase, a stitched quote, and an empty one', () => {
    expect(quoteAppearsIn(passage, 'The Constitution is the highest law.')).toBe(false);
    expect(quoteAppearsIn(passage, 'The Constitution was written in 1787')).toBe(false);
    expect(quoteAppearsIn(passage, '   ')).toBe(false);
  });
});

describe('locateQuote', () => {
  it('finds where the quote sits so it can be highlighted', () => {
    const passage = 'Intro.\nThe Constitution is the\nsupreme law. More text.';
    const found = locateQuote(passage, 'the constitution is the supreme law.');
    expect(found).not.toBeNull();
    expect(passage.slice(found!.start, found!.end)).toBe('The Constitution is the\nsupreme law.');
  });

  it('treats punctuation in the quote literally', () => {
    expect(locateQuote('Answers (will) vary. [See note]', '(will) vary. [See note]')).toEqual({
      start: 8,
      end: 31,
    });
    expect(locateQuote('abc', 'a.c')).toBeNull();
  });
});

describe('slugify', () => {
  it('makes lowercase hyphenated ASCII', () => {
    expect(slugify('System of Government')).toBe('system-of-government');
    expect(slugify('  Geschichte & Verantwortung ')).toBe('geschichte-verantwortung');
    expect(slugify('Rechte und Pflichten der Bürger')).toBe('rechte-und-pflichten-der-burger');
    expect(slugify('Fußball')).toBe('fussball');
  });
});
