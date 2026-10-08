import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { parseCsv } from '@oathly/core';

import {
  flashcardSchema,
  glossaryEntrySchema,
  isImportable,
  jsonSchemas,
  reviewColumns,
  reviewVerdicts,
  sourceManifestSchema,
  translationRecordSchema,
} from './pack';
import {
  confidenceLevels,
  countryProfileSchema,
  questionRecordSchema,
  recordProblems,
  reusability,
  type CountryProfile,
} from './records';
import { sha256 } from './text';

// The data folder at the repository root: researched country profiles, their
// index, draft question files, and the JSON Schemas generated for them.
//
//   data/schemas/*.schema.json     generated: `pnpm content schemas`
//   data/countries/<ISO>.json      one CountryProfile per country with a test
//   data/countries/_index.csv      every country researched, one line each
//   data/questions/<ISO>/*.json    QuestionRecords, one or a list per file
//   data/questions/<ISO>/review.csv, i18n/<locale>.json   verdicts and translations
//   data/sources/<ISO>/sources.json, topic_map.md        the official material
//   data/content/<ISO>/flashcards.json, glossary.json    study content

/** The index's columns, in order. */
export const indexColumns = [
  'iso',
  'name',
  'has_test',
  'test_name',
  'format',
  'official_material_url',
  'material_license',
  'reusable_official_questions',
  'confidence',
  'notes',
] as const;

/** The JSON Schema files as text, by name: what `pnpm content schemas` writes. */
export function jsonSchemaFiles(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(jsonSchemas()).map(([name, schema]) => [
      name,
      `${JSON.stringify(schema, null, 2)}\n`,
    ]),
  );
}

/** Writes the JSON Schema files into data/schemas. Returns the paths written. */
export function writeJsonSchemas(dataDir: string): string[] {
  const folder = path.join(dataDir, 'schemas');
  mkdirSync(folder, { recursive: true });
  return Object.entries(jsonSchemaFiles()).map(([name, text]) => {
    const file = path.join(folder, name);
    writeFileSync(file, text);
    return file;
  });
}

/** One line of the index, summarising a profile: the columns after iso and name. */
export function indexFormat(profile: Pick<CountryProfile, 'format'>): string {
  const format = profile.format;
  if (!format) return '';
  const parts = [
    format.question_count === null ? null : `${format.question_count} questions`,
    format.pass_mark !== null
      ? `${format.pass_mark} to pass`
      : format.pass_percent !== null
        ? `${format.pass_percent}% to pass`
        : null,
    format.time_limit_minutes === null ? null : `${format.time_limit_minutes} min`,
    format.modes.join('/'),
  ];
  return parts.filter(Boolean).join(', ');
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));

export interface DataReport {
  profiles: number;
  indexRows: number;
  questions: number;
  sources: number;
  flashcards: number;
  translations: number;
  reviewed: number;
  /** Everything wrong, each line starting with the file it is in. */
  problems: string[];
}

/** Checks every file in the data folder against its schema, and the index against the profiles. */
export function validateDataFiles(dataDir: string): DataReport {
  const report: DataReport = {
    profiles: 0,
    indexRows: 0,
    questions: 0,
    sources: 0,
    flashcards: 0,
    translations: 0,
    reviewed: 0,
    problems: [],
  };
  const at = (file: string) => path.relative(dataDir, file);
  const note = (file: string, problems: string[]) =>
    report.problems.push(...problems.map((problem) => `${at(file)}: ${problem}`));

  // Country profiles.
  const countries = path.join(dataDir, 'countries');
  const profiles = new Map<string, CountryProfile>();
  if (existsSync(countries)) {
    for (const name of readdirSync(countries).sort()) {
      if (!name.endsWith('.json')) continue;
      const file = path.join(countries, name);
      report.profiles += 1;
      let value: unknown;
      try {
        value = readJson(file);
      } catch (error) {
        note(file, [`not JSON: ${error instanceof Error ? error.message : String(error)}`]);
        continue;
      }
      const problems = recordProblems(countryProfileSchema, value);
      if (problems.length > 0) {
        note(file, problems);
        continue;
      }
      const profile = countryProfileSchema.parse(value);
      if (name !== `${profile.iso}.json`) note(file, [`should be named ${profile.iso}.json`]);
      profiles.set(profile.iso, profile);
    }
  }

  // The index: one line per country researched, whether or not it has a test.
  const index = path.join(countries, '_index.csv');
  if (existsSync(index)) {
    const [header = [], ...rows] = parseCsv(readFileSync(index, 'utf8')).filter((row) =>
      row.some((cell) => cell.trim() !== ''),
    );
    if (header.join(',') !== indexColumns.join(',')) {
      note(index, [`the columns must be: ${indexColumns.join(', ')}`]);
    } else {
      const seen = new Set<string>();
      for (const row of rows) {
        report.indexRows += 1;
        const cell = Object.fromEntries(indexColumns.map((column, i) => [column, row[i] ?? '']));
        const iso = cell.iso!;
        const here = (problem: string) => note(index, [`${iso || '(no iso)'}: ${problem}`]);
        if (!/^[A-Z]{2}$/.test(iso)) here('iso must be two capital letters');
        if (seen.has(iso)) here('listed twice');
        seen.add(iso);
        if (!cell.name) here('needs a name');
        if (cell.has_test !== 'yes' && cell.has_test !== 'no' && cell.has_test !== 'unclear') {
          here('has_test must be yes, no or unclear');
        }
        if (!(confidenceLevels as readonly string[]).includes(cell.confidence!)) {
          here('confidence must be high, medium or low');
        }
        if (
          cell.has_test === 'yes' &&
          !(reusability as readonly string[]).includes(cell.reusable_official_questions!)
        ) {
          here('reusable_official_questions must be yes, no or unclear');
        }
        // A country with a test has a profile, and the two agree.
        const profile = profiles.get(iso);
        if (cell.has_test === 'yes' && !profile)
          here(`says there is a test, but ${iso}.json is missing`);
        if (profile && cell.has_test !== (profile.has_exam ? 'yes' : 'no')) {
          here(`disagrees with ${iso}.json about whether there is a test`);
        }
        if (profile && cell.confidence !== profile.confidence) {
          here(`disagrees with ${iso}.json about confidence`);
        }
      }
      for (const iso of profiles.keys()) {
        if (!seen.has(iso)) note(index, [`${iso}: has a profile but no line in the index`]);
      }
    }
  } else if (profiles.size > 0) {
    note(index, ['missing: every researched country needs a line in the index']);
  }

  const readChecked = (file: string): unknown => {
    try {
      return readJson(file);
    } catch (error) {
      note(file, [`not JSON: ${error instanceof Error ? error.message : String(error)}`]);
      return undefined;
    }
  };
  const countryFolders = (root: string) =>
    existsSync(root)
      ? readdirSync(root)
          .filter((name) => /^[A-Z]{2}$/.test(name))
          .sort()
      : [];

  // Source packs: the manifest, its topic map, and any copies that are here.
  // The copies are not tracked, so a missing one is not a problem; a copy that
  // no longer matches its recorded hash is.
  const importable = new Map<string, Set<string>>();
  const sources = path.join(dataDir, 'sources');
  for (const iso of countryFolders(sources)) {
    const file = path.join(sources, iso, 'sources.json');
    if (!existsSync(file)) {
      note(file, ['missing: a source folder needs its sources.json']);
      continue;
    }
    const value = readChecked(file);
    if (value === undefined) continue;
    const problems = recordProblems(sourceManifestSchema, value);
    if (problems.length > 0) {
      note(file, problems);
      continue;
    }
    const manifest = sourceManifestSchema.parse(value);
    report.sources += manifest.sources.length;
    if (manifest.iso !== iso) note(file, [`is for ${manifest.iso}, in ${iso}'s folder`]);
    if (!existsSync(path.join(sources, iso, 'topic_map.md'))) {
      note(file, ['topic_map.md is missing beside it']);
    }
    importable.set(iso, new Set(manifest.sources.filter(isImportable).map((source) => source.url)));
    for (const source of manifest.sources) {
      if (!source.file) continue;
      const copy = path.join(sources, iso, source.file);
      if (existsSync(copy) && sha256(readFileSync(copy)) !== source.sha256) {
        note(file, [`${source.id}: ${source.file} does not match its recorded SHA-256`]);
      }
    }
  }

  // Study content: flashcards and the glossary.
  const cardIds = new Map<string, Set<string>>();
  const content = path.join(dataDir, 'content');
  for (const iso of countryFolders(content)) {
    const lists = [
      ['flashcards.json', flashcardSchema],
      ['glossary.json', glossaryEntrySchema],
    ] as const;
    for (const [name, schema] of lists) {
      const file = path.join(content, iso, name);
      if (!existsSync(file)) continue;
      const value = readChecked(file);
      if (value === undefined) continue;
      if (!Array.isArray(value)) {
        note(file, ['must be a list']);
        continue;
      }
      value.forEach((entry: unknown, i) => {
        const problems = recordProblems(schema, entry);
        if (problems.length > 0) {
          note(
            file,
            problems.map((problem) => `[${i}] ${problem}`),
          );
          return;
        }
        if (name !== 'flashcards.json') return;
        report.flashcards += 1;
        const card = flashcardSchema.parse(entry);
        if (card.country_iso !== iso)
          note(file, [`[${i}] is for ${card.country_iso}, in ${iso}'s folder`]);
        const ids = cardIds.get(iso) ?? new Set<string>();
        if (ids.has(card.id)) note(file, [`[${i}] id ${card.id} is used twice`]);
        cardIds.set(iso, ids.add(card.id));
      });
    }
  }

  // Question files: a record, or a list of them.
  const questions = path.join(dataDir, 'questions');
  const ids = new Set<string>();
  for (const iso of countryFolders(questions)) {
    const inFolder = path.join(questions, iso);
    const own = new Set<string>();
    let official = 0;
    for (const name of readdirSync(inFolder).sort()) {
      if (!name.endsWith('.json')) continue;
      const file = path.join(inFolder, name);
      const value = readChecked(file);
      if (value === undefined) continue;
      (Array.isArray(value) ? value : [value]).forEach((record: unknown, i) => {
        report.questions += 1;
        const problems = recordProblems(questionRecordSchema, record);
        if (problems.length > 0) {
          note(
            file,
            problems.map((problem) => `[${i}] ${problem}`),
          );
          return;
        }
        const question = questionRecordSchema.parse(record);
        if (question.country_iso !== iso) {
          note(file, [`[${i}] is for ${question.country_iso}, in ${iso}'s folder`]);
        }
        if (ids.has(question.id)) note(file, [`[${i}] id ${question.id} is used twice`]);
        ids.add(question.id);
        own.add(question.id);
        // The government's own wording is copied only from a source whose
        // licence allows it, and is kept in files of its own.
        if (question.origin === 'official') {
          official += 1;
          if (!name.startsWith('official')) {
            note(file, [`[${i}] is an official question: it belongs in official.json`]);
          }
          if (!importable.get(iso)?.has(question.source.url)) {
            note(file, [
              `[${i}] is copied from ${question.source.url}, which sources.json does not list as public domain or openly licensed for commercial use`,
            ]);
          }
        } else if (name.startsWith('official')) {
          note(file, [`[${i}] is our own question, in a file of official ones`]);
        }
      });
    }
    if (official > 0 && existsSync(path.join(inFolder, 'LICENSE_NOTE.md'))) {
      note(path.join(inFolder, 'LICENSE_NOTE.md'), [
        'says official questions were not imported, but the folder has some',
      ]);
    }

    // The fact-checker's verdicts.
    const review = path.join(inFolder, 'review.csv');
    if (existsSync(review)) {
      const [header = [], ...rows] = parseCsv(readFileSync(review, 'utf8')).filter((row) =>
        row.some((cell) => cell.trim() !== ''),
      );
      if (header.join(',') !== reviewColumns.join(',')) {
        note(review, [`the columns must be: ${reviewColumns.join(', ')}`]);
      } else {
        const judged = new Set<string>();
        for (const [id = '', verdict = '', reason = ''] of rows) {
          report.reviewed += 1;
          if (!own.has(id)) note(review, [`${id || '(no id)'}: no such question in this folder`]);
          if (judged.has(id)) note(review, [`${id}: judged twice`]);
          judged.add(id);
          if (!(reviewVerdicts as readonly string[]).includes(verdict)) {
            note(review, [`${id}: verdict must be ${reviewVerdicts.join(', ')}`]);
          } else if (verdict !== 'pass' && !reason.trim()) {
            note(review, [`${id}: a verdict other than pass needs a reason`]);
          }
        }
      }
    }

    // Translations, one file per language, each beside its original.
    const i18n = path.join(inFolder, 'i18n');
    if (!existsSync(i18n)) continue;
    for (const name of readdirSync(i18n).sort()) {
      if (!name.endsWith('.json')) continue;
      const file = path.join(i18n, name);
      const value = readChecked(file);
      if (value === undefined) continue;
      if (!Array.isArray(value)) {
        note(file, ['must be a list']);
        continue;
      }
      value.forEach((entry: unknown, i) => {
        report.translations += 1;
        const problems = recordProblems(translationRecordSchema, entry);
        if (problems.length > 0) {
          note(
            file,
            problems.map((problem) => `[${i}] ${problem}`),
          );
          return;
        }
        const translation = translationRecordSchema.parse(entry);
        if (`${translation.locale}.json` !== name) {
          note(file, [`[${i}] is in ${translation.locale}, in the file for ${name.slice(0, -5)}`]);
        }
        const known = translation.kind === 'question' ? own : cardIds.get(iso);
        if (!known?.has(translation.id)) {
          note(file, [
            `[${i}] translates ${translation.id}, which is not one of ${iso}'s ${translation.kind}s`,
          ]);
        }
      });
    }
  }
  return report;
}
