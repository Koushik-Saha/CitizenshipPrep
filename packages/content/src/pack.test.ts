import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateDataFiles } from './data-files';
import {
  flashcardSchema,
  glossaryEntrySchema,
  isImportable,
  sourceManifestSchema,
  translationRecordSchema,
  type SourceManifest,
} from './pack';
import { difficultyBand, questionStats } from './question-stats';
import { recordProblems, type QuestionRecord } from './records';
import { download, recheckSourceFiles, saveSourceFile, sourceFileName } from './source-files';
import { normalizeText, sha256 } from './text';

const NOW = '2026-10-08T12:00:00Z';
const GUIDE = 'https://example.test/guide.pdf';
const GUIDE_TEXT = 'Parliament is made up of two chambers.';

const source = {
  id: 'study-guide',
  kind: 'study_guide',
  title: 'Life in Testland',
  url: GUIDE,
  publisher: 'Testland Ministry of the Interior',
  publication_date: '2025-01-01',
  version: '3rd edition',
  language: 'en',
  region: null,
  license: {
    class: 'open_license',
    name: 'CC BY 4.0',
    commercial_use: 'allowed',
    text: 'This publication is licensed under a Creative Commons Attribution 4.0 licence.',
    url: 'https://example.test/copyright',
  },
  file: 'guide.txt',
  sha256: sha256(GUIDE_TEXT),
  text_sha256: sha256(GUIDE_TEXT),
  bytes: GUIDE_TEXT.length,
  retrieved_at: NOW,
  notes: null,
} satisfies SourceManifest['sources'][number];

const manifest = {
  iso: 'ZZ',
  researched_at: NOW,
  sources: [source],
  not_found: [
    { kind: 'question_bank', searched: 'The ministry publishes no list of questions.' },
    { kind: 'practice_test', searched: 'None on the ministry site.' },
    { kind: 'interview_questions', searched: 'The test is written; there is no interview.' },
    { kind: 'format_page', searched: 'The format is given in the guide itself, page 2.' },
  ],
} satisfies SourceManifest;

const question = {
  id: '3f0e3c0a-7c0b-4a55-9d0e-0d1c2b3a4f51',
  country_iso: 'ZZ',
  exam_version: 'civics-2025',
  topic: 'Government',
  subtopic: null,
  type: 'multiple_choice',
  difficulty: 2,
  language: 'en',
  question: 'How many chambers does the Testland parliament have?',
  options: ['One', 'Two', 'Three', 'Four'],
  correct_option_index: 1,
  explanation: 'The Testland parliament has two chambers. Laws must pass both of them.',
  source: {
    title: 'Life in Testland',
    url: GUIDE,
    section_or_page: 'Chapter 2, page 14',
    quote_under_25_words: GUIDE_TEXT,
    publisher: 'Testland Ministry of the Interior',
    license: 'CC BY 4.0',
  },
  origin: 'original',
  official_number: null,
  style: 'standard',
  needs_freshness_check: false,
  region: null,
  status: 'draft',
  created_at: NOW,
  verified_at: null,
} satisfies QuestionRecord;

const card = {
  id: '9a1b2c3d-0000-4000-8000-000000000001',
  country_iso: 'ZZ',
  topic: 'Government',
  subtopic: null,
  language: 'en',
  front: 'How many chambers has parliament?',
  back: 'Two.',
  source: { url: GUIDE, section_or_page: 'Page 14' },
  needs_freshness_check: false,
};

const translation = {
  kind: 'question',
  id: question.id,
  locale: 'es',
  source_language: 'en',
  untranslated_terms: [{ term: 'Landtag', note: 'The name of the regional assembly.' }],
  status: 'needs_native_review',
  translated_at: NOW,
  original: {
    question: question.question,
    options: question.options,
    answers: ['Two'],
    explanation: question.explanation,
  },
  translation: {
    question: '¿Cuántas cámaras tiene el parlamento de Testland?',
    options: ['Una', 'Dos', 'Tres', 'Cuatro'],
    answers: ['Dos'],
    explanation: 'El parlamento tiene dos cámaras, a diferencia del [Landtag] regional.',
  },
};

const manifestProblems = (change: Record<string, unknown>) =>
  recordProblems(sourceManifestSchema, { ...manifest, ...change });
const withSource = (change: Record<string, unknown>) =>
  manifestProblems({ sources: [{ ...source, ...change }] });
const withLicense = (change: Record<string, unknown>) =>
  withSource({ license: { ...source.license, ...change } });

/** A fetch that serves the given bodies by address, and 404 for anything else. */
const serving =
  (pages: Record<string, string>): typeof fetch =>
  (input) => {
    const url = String(input);
    const body = pages[url];
    return Promise.resolve(
      body === undefined
        ? new Response('gone', { status: 404, statusText: 'Not Found' })
        : new Response(body, { headers: { 'content-type': 'text/plain' } }),
    );
  };

describe('sourceManifestSchema', () => {
  it('accepts a pack that accounts for every kind of resource', () => {
    expect(manifestProblems({})).toEqual([]);
  });

  it('wants each kind found, or a note of where it was looked for', () => {
    expect(manifestProblems({ not_found: manifest.not_found.slice(1) })).toEqual([
      'not_found: Nothing says whether a question_bank exists: list one, or say where it was looked for.',
    ]);
  });

  it('wants the licence classified from the publisher’s own words', () => {
    expect(withLicense({ name: null })).toEqual([
      'sources.0.license: An open licence has to be named.',
    ]);
    expect(withLicense({ text: null })).toHaveLength(1);
    expect(withLicense({ class: 'public_domain', commercial_use: 'unknown' })).toEqual([
      'sources.0.license: Public domain allows commercial use.',
    ]);
    expect(withLicense({ class: 'all_rights_reserved' })).toEqual([
      'sources.0.license: If commercial reuse is allowed, it is not all rights reserved.',
    ]);
    // Nothing found is a class of its own, and needs no wording.
    expect(
      withLicense({
        class: 'reuse_unclear',
        name: null,
        commercial_use: 'unknown',
        text: null,
        url: null,
      }),
    ).toEqual([]);
    expect(withLicense({ class: 'free' })).toHaveLength(1);
  });

  it('keeps a copy, its hash and its size together', () => {
    expect(withSource({ sha256: null })).toEqual([
      'sources.0.file: file, sha256 and bytes go together: all set, or all null.',
    ]);
    expect(withSource({ file: null, sha256: null, bytes: null })).toEqual([
      'sources.0.notes: Say why there is no downloaded copy.',
    ]);
    expect(
      withSource({ file: null, sha256: null, bytes: null, notes: 'An interactive test.' }),
    ).toEqual([]);
    expect(withSource({ file: '../guide.pdf' })).toHaveLength(1);
    expect(withSource({ region: 'DE-BY' })).toEqual([
      "sources.0.region: The region must be one of ZZ's.",
    ]);
    expect(manifestProblems({ sources: [source, source] })).toEqual([
      'sources.1.id: "study-guide" is used twice.',
      'sources.1.file: "guide.txt" is used twice.',
    ]);
  });
});

describe('isImportable', () => {
  const licensed = (license: Record<string, unknown>) =>
    isImportable({ license: { ...source.license, ...license } } as never);
  it('is true only for public domain, or an open licence that allows commercial use', () => {
    expect(licensed({})).toBe(true);
    expect(licensed({ class: 'public_domain' })).toBe(true);
    expect(licensed({ commercial_use: 'not_allowed' })).toBe(false);
    expect(licensed({ commercial_use: 'unknown' })).toBe(false);
    expect(licensed({ class: 'reuse_unclear' })).toBe(false);
    expect(licensed({ class: 'all_rights_reserved', commercial_use: 'not_allowed' })).toBe(false);
  });
});

describe('study content and translations', () => {
  it('accepts a flashcard and a glossary entry with their sources', () => {
    expect(recordProblems(flashcardSchema, card)).toEqual([]);
    expect(recordProblems(flashcardSchema, { ...card, source: { url: GUIDE } })).toHaveLength(1);
    const entry = {
      term: 'Chamber',
      definition: 'One of the two houses of the Testland parliament.',
      language: 'en',
      topic: null,
      source: card.source,
    };
    expect(recordProblems(glossaryEntrySchema, entry)).toEqual([]);
    expect(recordProblems(glossaryEntrySchema, { ...entry, definition: 'House.' })).toHaveLength(1);
  });

  it('keeps a translation whole, beside its original', () => {
    const problems = (change: Record<string, unknown>) =>
      recordProblems(translationRecordSchema, { ...translation, ...change });
    expect(problems({})).toEqual([]);
    expect(problems({ locale: 'en' })).toEqual(['locale: A translation is into another language.']);
    expect(
      problems({ translation: { ...translation.translation, options: ['Una', 'Dos', 'Tres'] } }),
    ).toEqual(['translation.options: The translation must keep every option.']);
    expect(
      problems({ translation: { ...translation.translation, answers: ['Dos', 'Tres'] } }),
    ).toEqual(['translation.answers: The translation must keep every answer.']);
    expect(
      problems({
        translation: {
          ...translation.translation,
          explanation: 'El parlamento tiene dos cámaras.',
        },
      }),
    ).toEqual(['untranslated_terms.0: "[Landtag]" must appear in the translation, in brackets.']);
    expect(problems({ status: 'published' })).toHaveLength(1);
    expect(
      recordProblems(translationRecordSchema, {
        ...translation,
        kind: 'flashcard',
        untranslated_terms: [],
        original: { front: card.front, back: card.back },
        translation: { front: '¿Cuántas cámaras?', back: 'Dos.' },
      }),
    ).toEqual([]);
  });
});

describe('downloading sources', () => {
  it('names a file safely from its address', () => {
    expect(sourceFileName('https://x.test/a/Our%20Common%20Bond.pdf', 'application/pdf')).toBe(
      'Our-Common-Bond.pdf',
    );
    expect(sourceFileName('https://x.test/citizenship/test', 'text/html')).toBe('test.html');
    expect(sourceFileName('https://www.x.test/', 'text/html')).toBe('www-x-test.html');
    expect(sourceFileName('https://x.test/a', 'text/html', '../../etc/passwd')).toBe(
      'etc-passwd.html',
    );
  });

  it('saves a copy and reports its hash, without touching the manifest', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'oathly-src-'));
    const saved = await saveSourceFile(dir, 'ZZ', GUIDE, {
      name: 'guide.txt',
      fetchImpl: serving({ [GUIDE]: GUIDE_TEXT }),
      now: new Date(NOW),
    });
    expect(saved).toEqual({
      file: 'guide.txt',
      sha256: sha256(GUIDE_TEXT),
      text_sha256: sha256(GUIDE_TEXT),
      bytes: GUIDE_TEXT.length,
      media_type: 'text/plain',
      final_url: GUIDE,
      retrieved_at: '2026-10-08T12:00:00.000Z',
    });
    expect(readFileSync(path.join(dir, 'sources/ZZ/guide.txt'), 'utf8')).toBe(GUIDE_TEXT);
    expect(existsSync(path.join(dir, 'sources/ZZ/sources.json'))).toBe(false);

    await expect(saveSourceFile(dir, 'zz', GUIDE)).rejects.toThrow('two capital letters');
    await expect(
      saveSourceFile(dir, 'ZZ', GUIDE, {
        name: 'sources.json',
        fetchImpl: serving({ [GUIDE]: 'x' }),
      }),
    ).rejects.toThrow("pack's own file");
    await expect(download('https://example.test/missing', serving({}))).rejects.toThrow('HTTP 404');
    await expect(download(GUIDE, serving({ [GUIDE]: '' }))).rejects.toThrow('empty');
  });

  it('says which sources have changed since they were recorded', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'oathly-src-'));
    const folder = path.join(dir, 'sources/ZZ');
    mkdirSync(folder, { recursive: true });
    const page = {
      ...source,
      id: 'format-page',
      kind: 'format_page',
      url: 'https://example.test/test',
      file: 'test.txt',
      sha256: sha256('The test has 20   questions.'),
      text_sha256: sha256(normalizeText('The test has 20 questions.')),
    };
    const practice = {
      ...source,
      id: 'practice',
      kind: 'practice_test',
      url: 'https://example.test/practice',
      file: null,
      sha256: null,
      text_sha256: null,
      bytes: null,
      notes: 'An interactive test.',
    };
    const gone = {
      ...source,
      id: 'old-guide',
      url: 'https://example.test/old.pdf',
      file: 'old.txt',
    };
    writeFileSync(
      path.join(folder, 'sources.json'),
      JSON.stringify({ ...manifest, sources: [source, page, practice, gone] }),
    );
    const results = await recheckSourceFiles(
      dir,
      'ZZ',
      serving({
        [GUIDE]: 'Parliament is made up of three chambers.',
        // Different bytes, the same words.
        'https://example.test/test': 'The test has 20 questions.',
      }),
    );
    expect(results.map(({ id, result }) => [id, result])).toEqual([
      ['study-guide', 'changed'],
      ['format-page', 'same'],
      ['practice', 'not_downloaded'],
      ['old-guide', 'unreachable'],
    ]);
    // The new version is kept beside the old one, and the manifest is left alone.
    expect(readFileSync(path.join(folder, 'guide.txt.new'), 'utf8')).toContain('three chambers');
    expect(
      JSON.parse(readFileSync(path.join(folder, 'sources.json'), 'utf8')).sources[0].sha256,
    ).toBe(source.sha256);
  });
});

describe('a country’s pack, validated', () => {
  const pack = (change: (dir: string) => void = () => {}) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'oathly-pack-'));
    for (const folder of ['sources/ZZ', 'questions/ZZ/i18n', 'content/ZZ']) {
      mkdirSync(path.join(dir, folder), { recursive: true });
    }
    const write = (file: string, value: unknown) =>
      writeFileSync(
        path.join(dir, file),
        typeof value === 'string' ? value : JSON.stringify(value),
      );
    write('sources/ZZ/sources.json', manifest);
    write('sources/ZZ/topic_map.md', '# Topics\n');
    write('sources/ZZ/guide.txt', GUIDE_TEXT);
    write('questions/ZZ/original_government.json', [question]);
    write('questions/ZZ/review.csv', `id,verdict,reason\n${question.id},pass,\n`);
    write('questions/ZZ/i18n/es.json', [translation]);
    write('content/ZZ/flashcards.json', [card]);
    write('content/ZZ/glossary.json', []);
    change(dir);
    return validateDataFiles(dir);
  };
  const write = (dir: string, file: string, value: unknown) =>
    writeFileSync(path.join(dir, file), typeof value === 'string' ? value : JSON.stringify(value));
  const official = {
    ...question,
    id: crypto.randomUUID(),
    origin: 'official',
    official_number: '7',
  };

  it('passes when everything is in order', () => {
    expect(pack()).toEqual({
      profiles: 0,
      indexRows: 0,
      questions: 1,
      sources: 1,
      flashcards: 1,
      translations: 1,
      reviewed: 1,
      problems: [],
    });
  });

  it('notices a copy that no longer matches its hash, and a missing topic map', () => {
    const { problems } = pack((dir) => {
      write(dir, 'sources/ZZ/guide.txt', 'Something else.');
      write(dir, 'sources/ZZ/sources.json', { ...manifest, iso: 'ZY' });
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        "sources/ZZ/sources.json: is for ZY, in ZZ's folder",
        'sources/ZZ/sources.json: study-guide: guide.txt does not match its recorded SHA-256',
      ]),
    );
    const dir = mkdtempSync(path.join(tmpdir(), 'oathly-pack-'));
    mkdirSync(path.join(dir, 'sources/ZZ'), { recursive: true });
    mkdirSync(path.join(dir, 'sources/ZY'), { recursive: true });
    write(dir, 'sources/ZZ/sources.json', manifest);
    // The copy is not tracked: without it there is nothing to compare, and no complaint.
    expect(validateDataFiles(dir).problems).toEqual([
      'sources/ZY/sources.json: missing: a source folder needs its sources.json',
      'sources/ZZ/sources.json: topic_map.md is missing beside it',
    ]);
  });

  it('lets official questions in only from a source that allows it', () => {
    expect(pack((dir) => write(dir, 'questions/ZZ/official.json', [official])).problems).toEqual(
      [],
    );
    const closed = {
      ...manifest,
      sources: [{ ...source, license: { ...source.license, commercial_use: 'not_allowed' } }],
    };
    const { problems } = pack((dir) => {
      write(dir, 'sources/ZZ/sources.json', closed);
      write(dir, 'questions/ZZ/official.json', [
        official,
        { ...question, id: crypto.randomUUID() },
      ]);
      write(dir, 'questions/ZZ/original_government.json', [
        question,
        { ...official, id: crypto.randomUUID() },
      ]);
      write(dir, 'questions/ZZ/LICENSE_NOTE.md', 'Not imported.');
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        `questions/ZZ/official.json: [0] is copied from ${GUIDE}, which sources.json does not list as public domain or openly licensed for commercial use`,
        'questions/ZZ/official.json: [1] is our own question, in a file of official ones',
        'questions/ZZ/original_government.json: [1] is an official question: it belongs in official.json',
        'questions/ZZ/LICENSE_NOTE.md: says official questions were not imported, but the folder has some',
      ]),
    );
  });

  it('checks the verdicts and the translations against the questions', () => {
    const other = crypto.randomUUID();
    const { problems } = pack((dir) => {
      write(
        dir,
        'questions/ZZ/review.csv',
        `id,verdict,reason\n${question.id},reject,\n${question.id},maybe,x\n${other},pass,\n`,
      );
      write(dir, 'questions/ZZ/i18n/es.json', [
        { ...translation, locale: 'fr' },
        { ...translation, id: other },
        {
          ...translation,
          kind: 'flashcard',
          id: other,
          untranslated_terms: [],
          original: { front: 'a', back: 'b' },
          translation: { front: 'c', back: 'd' },
        },
        { ...translation, status: 'published' },
      ]);
      write(dir, 'content/ZZ/flashcards.json', [
        card,
        card,
        { ...card, id: crypto.randomUUID(), country_iso: 'ZY' },
        { ...card, back: '' },
      ]);
      write(dir, 'content/ZZ/glossary.json', { not: 'a list' });
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        `questions/ZZ/review.csv: ${question.id}: a verdict other than pass needs a reason`,
        `questions/ZZ/review.csv: ${question.id}: judged twice`,
        `questions/ZZ/review.csv: ${question.id}: verdict must be pass, fixed, fix, reject`,
        `questions/ZZ/review.csv: ${other}: no such question in this folder`,
        'questions/ZZ/i18n/es.json: [0] is in fr, in the file for es',
        `questions/ZZ/i18n/es.json: [1] translates ${other}, which is not one of ZZ's questions`,
        `questions/ZZ/i18n/es.json: [2] translates ${other}, which is not one of ZZ's flashcards`,
        `content/ZZ/flashcards.json: [1] id ${card.id} is used twice`,
        "content/ZZ/flashcards.json: [2] is for ZY, in ZZ's folder",
        'content/ZZ/glossary.json: must be a list',
      ]),
    );
    expect(problems.some((p) => p.startsWith('questions/ZZ/i18n/es.json: [3] status'))).toBe(true);
    expect(problems.some((p) => p.startsWith('content/ZZ/flashcards.json: [3] back'))).toBe(true);
    expect(pack((dir) => write(dir, 'questions/ZZ/review.csv', 'id,result\n')).problems).toEqual([
      'questions/ZZ/review.csv: the columns must be: id, verdict, reason',
    ]);
    expect(pack((dir) => write(dir, 'questions/ZZ/i18n/es.json', '{')).problems[0]).toMatch(
      /not JSON/,
    );
  });
});

describe('questionStats', () => {
  it('bands difficulty the way targets are set', () => {
    expect([1, 2, 3, 4, 5].map(difficultyBand)).toEqual(['easy', 'easy', 'medium', 'hard', 'hard']);
  });

  it('counts a country’s questions and points at ones worded alike', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'oathly-stats-'));
    mkdirSync(path.join(dir, 'questions/ZZ'), { recursive: true });
    const again = {
      ...question,
      id: crypto.randomUUID(),
      question: 'How many chambers does the Testland Parliament have',
    };
    const regional = { ...again, id: crypto.randomUUID(), region: 'ZZ-N' };
    const hard = {
      ...question,
      id: crypto.randomUUID(),
      topic: 'History',
      difficulty: 5,
      style: 'which_is_not',
      needs_freshness_check: true,
      question: 'Which of these was not a founding province of Testland?',
    };
    writeFileSync(
      path.join(dir, 'questions/ZZ/original_government.json'),
      JSON.stringify([question, again, regional]),
    );
    writeFileSync(
      path.join(dir, 'questions/ZZ/original_history.json'),
      JSON.stringify([hard, { broken: true }]),
    );
    const stats = questionStats(dir, 'ZZ');
    expect(stats).toMatchObject({
      total: 4,
      byFile: { 'original_government.json': 3, 'original_history.json': 1 },
      byTopic: { Government: 3, History: 1 },
      byBand: { easy: 3, hard: 1 },
      byType: { multiple_choice: 4 },
      byStyle: { standard: 3, which_is_not: 1 },
      byOrigin: { original: 4 },
      byStatus: { draft: 4 },
      freshnessChecks: 1,
    });
    // The regional copy is not a duplicate of the national one.
    expect(stats.alike).toHaveLength(1);
    expect(stats.alike[0]).toMatchObject({ a: question.id, b: again.id });
    expect(questionStats(dir, 'ZY').total).toBe(0);
  });
});
