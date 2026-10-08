import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { parseCsv } from '@oathly/core';

import {
  confidenceLevels,
  countryProfileSchema,
  jsonSchemas,
  questionRecordSchema,
  recordProblems,
  reusability,
  type CountryProfile,
} from './records';

// The data folder at the repository root: researched country profiles, their
// index, draft question files, and the JSON Schemas generated for them.
//
//   data/schemas/*.schema.json     generated: `pnpm content schemas`
//   data/countries/<ISO>.json      one CountryProfile per country with a test
//   data/countries/_index.csv      every country researched, one line each
//   data/questions/<ISO>/*.json    QuestionRecords, one or a list per file

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
  /** Everything wrong, each line starting with the file it is in. */
  problems: string[];
}

/** Checks every file in the data folder against its schema, and the index against the profiles. */
export function validateDataFiles(dataDir: string): DataReport {
  const report: DataReport = { profiles: 0, indexRows: 0, questions: 0, problems: [] };
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

  // Question files: a record, or a list of them.
  const questions = path.join(dataDir, 'questions');
  if (existsSync(questions)) {
    const ids = new Set<string>();
    for (const folder of readdirSync(questions).sort()) {
      const inFolder = path.join(questions, folder);
      if (!/^[A-Z]{2}$/.test(folder)) continue;
      for (const name of readdirSync(inFolder).sort()) {
        if (!name.endsWith('.json')) continue;
        const file = path.join(inFolder, name);
        let value: unknown;
        try {
          value = readJson(file);
        } catch (error) {
          note(file, [`not JSON: ${error instanceof Error ? error.message : String(error)}`]);
          continue;
        }
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
          if (question.country_iso !== folder) {
            note(file, [`[${i}] is for ${question.country_iso}, in ${folder}'s folder`]);
          }
          if (ids.has(question.id)) note(file, [`[${i}] id ${question.id} is used twice`]);
          ids.add(question.id);
        });
      }
    }
  }
  return report;
}
