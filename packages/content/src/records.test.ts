import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { indexColumns, indexFormat, jsonSchemaFiles, validateDataFiles } from './data-files';
import { repoRoot } from './env';
import {
  countryProfileSchema,
  countSentences,
  questionRecordSchema,
  recordProblems,
  type CountryProfile,
  type QuestionRecord,
} from './records';

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
  explanation:
    'The Testland parliament has two chambers. Laws must pass both before they take effect.',
  source: {
    title: 'Life in Testland',
    url: 'https://example.test/guide',
    section_or_page: 'Chapter 2, page 14',
    quote_under_25_words: 'Parliament is made up of two chambers.',
    publisher: 'Testland Ministry of the Interior',
    license: 'public-domain',
  },
  origin: 'original',
  region: null,
  status: 'draft',
  created_at: '2026-10-08T12:00:00Z',
  verified_at: null,
} satisfies QuestionRecord;

const profile = {
  iso: 'ZZ',
  name: 'Testland',
  has_exam: true,
  exam_name: 'Life in Testland test',
  administering_agency: 'Testland Ministry of the Interior',
  format: {
    question_count: 20,
    pass_mark: 15,
    pass_percent: null,
    time_limit_minutes: 30,
    question_pool_size: null,
    modes: ['computer'],
    notes: null,
  },
  languages: ['en'],
  regional_variants: [],
  exemptions: { age: 'Not required from the age of 65.', disability: null },
  fee: null,
  official_study_material: [
    {
      title: 'Life in Testland',
      url: 'https://example.test/guide',
      publisher: 'Testland Ministry of the Interior',
      kind: 'study_guide',
      language: 'en',
      license: null,
      reusable: 'unclear',
    },
  ],
  last_researched_at: '2026-10-08T12:00:00Z',
  citations: {
    has_exam: ['https://example.test/law'],
    exam_name: ['https://example.test/test'],
    administering_agency: ['https://example.test/test'],
    format: ['https://example.test/test'],
    languages: ['https://example.test/test'],
    regional_variants: ['https://example.test/test'],
    'exemptions.age': ['https://example.test/law'],
    official_study_material: ['https://example.test/guide'],
  },
  unverified: {
    'exemptions.disability': 'The law does not mention it.',
    fee: 'No fee is published for the test itself.',
  },
  confidence: 'medium',
  recent_change: null,
  notes: null,
} satisfies CountryProfile;

/** A copy without one of its fields. */
function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

const problemsWith = (change: Record<string, unknown>) =>
  recordProblems(questionRecordSchema, { ...question, ...change });
const profileProblems = (change: Record<string, unknown>) =>
  recordProblems(countryProfileSchema, { ...profile, ...change });

describe('countSentences', () => {
  it.each([
    ['One sentence.', 1],
    ['The first. The second.', 2],
    ['Is it? Yes! Good.', 3],
    ['The U.S. Senate has 100 members. Each serves six years.', 2],
    ['Dr. Smith wrote it. It costs 3.50 at example.test today.', 2],
    ['It ended in the U.S.', 1],
    ['He said "stop." Then he left.', 2],
    ['国会は二院制です。法律は両院を通過します。', 2],
    ['No full stop at the end', 1],
    ['', 0],
  ])('%s', (text, count) => {
    expect(countSentences(text)).toBe(count);
  });
});

describe('questionRecordSchema', () => {
  it('accepts a question of each type', () => {
    expect(problemsWith({})).toEqual([]);
    expect(
      problemsWith({ type: 'true_false', options: ['True', 'False'], correct_option_index: 0 }),
    ).toEqual([]);
    const rest = without(question, 'correct_option_index');
    expect(
      recordProblems(questionRecordSchema, {
        ...rest,
        type: 'multi_select',
        correct_answers: ['One', 'Two'],
      }),
    ).toEqual([]);
    expect(
      recordProblems(questionRecordSchema, {
        ...rest,
        type: 'free_response',
        options: [],
        correct_answers: ['Two', 'two chambers'],
      }),
    ).toEqual([]);
  });

  it('takes the answer one way or the other, by type, never both', () => {
    expect(problemsWith({ correct_answers: ['Two'] })).not.toEqual([]);
    const rest = without(question, 'correct_option_index');
    expect(recordProblems(questionRecordSchema, rest)).not.toEqual([]);
    expect(
      recordProblems(questionRecordSchema, {
        ...question,
        type: 'free_response',
        options: [],
      }),
    ).not.toEqual([]);
  });

  it('wants the answer to be one of the options', () => {
    expect(problemsWith({ correct_option_index: 4 })).toEqual([
      'correct_option_index: The right option must be one of the options.',
    ]);
    const rest = without(question, 'correct_option_index');
    expect(
      recordProblems(questionRecordSchema, {
        ...rest,
        type: 'multi_select',
        correct_answers: ['One', 'Five'],
      }),
    ).toEqual(['correct_answers.1: A right answer must be one of the options, word for word.']);
    expect(
      recordProblems(questionRecordSchema, {
        ...rest,
        type: 'free_response',
        options: [],
        correct_answers: ['Two', 'two'],
      }),
    ).toEqual(['correct_answers.1: Each answer must be different.']);
  });

  it('wants options that differ', () => {
    expect(problemsWith({ options: ['One', 'Two', 'two ', 'Four'] })).toEqual([
      'options.2: Each option must be different.',
    ]);
  });

  it('wants an explanation of two to four sentences', () => {
    expect(
      problemsWith({ explanation: 'The parliament has two chambers and that is all.' }),
    ).toEqual(['explanation: The explanation has 1 sentence(s); it needs two to four.']);
    expect(
      problemsWith({ explanation: 'One here. Two here. Three here. Four here. Five.' }),
    ).toEqual(['explanation: The explanation has 5 sentence(s); it needs two to four.']);
  });

  it('keeps the quote under 25 words', () => {
    const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');
    const withQuote = (quote: string) =>
      problemsWith({ source: { ...question.source, quote_under_25_words: quote } });
    expect(withQuote(words(24))).toEqual([]);
    expect(withQuote(words(25))).toHaveLength(1);
    expect(withQuote('')).toHaveLength(1);
  });

  it('is always an unverified draft', () => {
    expect(problemsWith({ status: 'published' })).toHaveLength(1);
    expect(problemsWith({ verified_at: '2026-10-08T12:00:00Z' })).toHaveLength(1);
  });

  it('keeps a region inside its country, and sources on the web', () => {
    expect(problemsWith({ region: 'ZZ-N' })).toEqual([]);
    expect(problemsWith({ region: 'DE-BY' })).toEqual(["region: The region must be one of ZZ's."]);
    const withUrl = (url: string) => problemsWith({ source: { ...question.source, url } });
    // Some governments publish only on plain http; a source is cited where it is.
    expect(withUrl('http://example.test/guide')).toEqual([]);
    expect(withUrl('ftp://example.test/guide')).toHaveLength(1);
    expect(withUrl('example.test/guide')).not.toEqual([]);
  });

  it('refuses fields it does not know', () => {
    expect(problemsWith({ verified_by: 'someone' })).not.toEqual([]);
  });
});

describe('countryProfileSchema', () => {
  it('accepts a profile whose facts are all cited or explained', () => {
    expect(profileProblems({})).toEqual([]);
  });

  it('wants every fact about a test cited, or a reason it is not', () => {
    const unverified = without(profile.unverified, 'fee');
    expect(profileProblems({ unverified })).toEqual([
      'fee: "fee" needs a citation, or a reason under "unverified".',
    ]);
    const citations = without(profile.citations, 'has_exam');
    expect(profileProblems({ citations })).toContain(
      'citations: Whether there is a test has to be cited.',
    );
    expect(
      profileProblems({ citations: { ...profile.citations, population: ['https://x.test'] } }),
    ).not.toEqual([]);
    expect(
      profileProblems({ citations: { ...profile.citations, fee: ['mailto:fees@example.test'] } }),
    ).not.toEqual([]);
  });

  it('accepts a country with no test, and nothing about one', () => {
    const none = {
      ...profile,
      has_exam: false,
      exam_name: null,
      administering_agency: null,
      format: null,
      languages: [],
      official_study_material: [],
      exemptions: { age: null, disability: null },
      citations: { has_exam: ['https://example.test/law'] },
      unverified: {},
    };
    expect(recordProblems(countryProfileSchema, none)).toEqual([]);
    expect(recordProblems(countryProfileSchema, { ...none, exam_name: 'A test' })).toEqual([
      'has_exam: A country with no test has no test name or format.',
    ]);
  });

  it('checks the numbers and the regions make sense', () => {
    expect(profileProblems({ format: { ...profile.format, pass_mark: 21 } })).toEqual([
      'format.pass_mark: The pass mark cannot be more than the number of questions.',
    ]);
    expect(
      profileProblems({ regional_variants: [{ region: 'DE-BY', name: 'Bavaria', note: null }] }),
    ).toEqual(["regional_variants: DE-BY is not one of ZZ's regions."]);
    expect(profileProblems({ exam_name: null })).toEqual([
      'exam_name: A test has a name, or a reason it could not be confirmed.',
    ]);
  });
});

describe('the JSON Schema files', () => {
  it('are the ones generated from the Zod schemas', () => {
    for (const [name, text] of Object.entries(jsonSchemaFiles())) {
      const onDisk = readFileSync(path.join(repoRoot, 'data/schemas', name), 'utf8');
      // Out of step? Run `pnpm content schemas`.
      expect(onDisk, name).toBe(text);
    }
  });

  it('say what a question and a profile hold', () => {
    const files = jsonSchemaFiles();
    const q = JSON.parse(files['question.schema.json']!);
    expect(q.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(q.oneOf).toHaveLength(4);
    for (const variant of q.oneOf) {
      expect(variant.additionalProperties).toBe(false);
      expect(variant.properties.status.const).toBe('draft');
      expect(variant.properties.verified_at.type).toBe('null');
      // One way of giving the answer, never both.
      expect(
        Number('correct_option_index' in variant.properties) +
          Number('correct_answers' in variant.properties),
      ).toBe(1);
    }
    const c = JSON.parse(files['country-profile.schema.json']!);
    expect(c.required).toEqual(
      expect.arrayContaining(['iso', 'has_exam', 'citations', 'unverified']),
    );
  });
});

describe('validateDataFiles', () => {
  const folder = () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'oathly-data-'));
    mkdirSync(path.join(dir, 'countries'));
    mkdirSync(path.join(dir, 'questions/ZZ'), { recursive: true });
    return dir;
  };
  const line = (cells: Record<string, string>) =>
    indexColumns.map((column) => cells[column] ?? '').join(',');
  const index = (dir: string, ...rows: Record<string, string>[]) =>
    writeFileSync(
      path.join(dir, 'countries/_index.csv'),
      [indexColumns.join(','), ...rows.map(line)].join('\n') + '\n',
    );
  const zz = {
    iso: 'ZZ',
    name: 'Testland',
    has_test: 'yes',
    reusable_official_questions: 'unclear',
    confidence: 'medium',
  };

  it('passes a folder that is in order, and an empty one', () => {
    expect(validateDataFiles(path.join(tmpdir(), 'oathly-no-such-folder'))).toEqual({
      profiles: 0,
      indexRows: 0,
      questions: 0,
      problems: [],
    });
    const dir = folder();
    writeFileSync(path.join(dir, 'countries/ZZ.json'), JSON.stringify(profile));
    index(dir, zz, { iso: 'ZY', name: 'Otherland', has_test: 'no', confidence: 'high' });
    writeFileSync(path.join(dir, 'questions/ZZ/government.json'), JSON.stringify([question]));
    expect(validateDataFiles(dir)).toEqual({
      profiles: 1,
      indexRows: 2,
      questions: 1,
      problems: [],
    });
  });

  it('says what is wrong, and where', () => {
    const dir = folder();
    writeFileSync(path.join(dir, 'countries/ZZ.json'), JSON.stringify(profile));
    writeFileSync(path.join(dir, 'countries/ZX.json'), JSON.stringify({ ...profile, fee: 12 }));
    writeFileSync(path.join(dir, 'countries/ZW.json'), '{ not json');
    index(
      dir,
      { ...zz, confidence: 'high' },
      {
        iso: 'ZY',
        name: 'Otherland',
        has_test: 'yes',
        reusable_official_questions: 'no',
        confidence: 'low',
      },
      { iso: 'ZY', name: '', has_test: 'maybe', confidence: 'sure' },
    );
    writeFileSync(
      path.join(dir, 'questions/ZZ/a.json'),
      JSON.stringify([
        question,
        question,
        { ...question, country_iso: 'ZY', id: crypto.randomUUID() },
        { ...question, status: 'published' },
      ]),
    );
    const { problems } = validateDataFiles(dir);
    expect(problems.filter((p) => p.startsWith('countries/ZX.json'))).not.toHaveLength(0);
    expect(problems.some((p) => p.startsWith('countries/ZW.json: not JSON'))).toBe(true);
    expect(problems).toEqual(
      expect.arrayContaining([
        'countries/_index.csv: ZZ: disagrees with ZZ.json about confidence',
        'countries/_index.csv: ZY: says there is a test, but ZY.json is missing',
        'countries/_index.csv: ZY: listed twice',
        'countries/_index.csv: ZY: needs a name',
        'countries/_index.csv: ZY: has_test must be yes, no or unclear',
        'countries/_index.csv: ZY: confidence must be high, medium or low',
        `questions/ZZ/a.json: [1] id ${question.id} is used twice`,
        "questions/ZZ/a.json: [2] is for ZY, in ZZ's folder",
      ]),
    );
    expect(problems.some((p) => p.startsWith('questions/ZZ/a.json: [3] status'))).toBe(true);
  });

  it('wants an index beside the profiles, with the right columns', () => {
    const dir = folder();
    writeFileSync(path.join(dir, 'countries/ZY.json'), JSON.stringify({ ...profile, iso: 'ZZ' }));
    expect(validateDataFiles(dir).problems).toEqual([
      'countries/ZY.json: should be named ZZ.json',
      'countries/_index.csv: missing: every researched country needs a line in the index',
    ]);
    writeFileSync(path.join(dir, 'countries/_index.csv'), 'iso,name\nZZ,Testland\n');
    expect(validateDataFiles(dir).problems[1]).toMatch(
      /_index\.csv: the columns must be: iso, name/,
    );
    index(dir);
    expect(validateDataFiles(dir).problems).toContain(
      'countries/_index.csv: ZZ: has a profile but no line in the index',
    );
  });
});

describe('the data folder in this repository', () => {
  it('is valid: every profile, the index and every question file', () => {
    // The same check as `pnpm content validate`.
    expect(validateDataFiles(path.join(repoRoot, 'data')).problems).toEqual([]);
  });
});

describe('indexFormat', () => {
  it('puts a format on one line', () => {
    expect(indexFormat(profile)).toBe('20 questions, 15 to pass, 30 min, computer');
    expect(
      indexFormat({
        format: {
          ...profile.format,
          pass_mark: null,
          pass_percent: 75,
          time_limit_minutes: null,
          modes: ['written', 'oral'],
        },
      }),
    ).toBe('20 questions, 75% to pass, written/oral');
    expect(indexFormat({ format: null })).toBe('');
  });
});
