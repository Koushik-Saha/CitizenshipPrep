import { z } from 'zod';

// The file formats content is researched and drafted in, before any of it
// reaches the database: one question (QuestionRecord) and one country's exam
// (CountryProfile). Zod is the definition; the JSON Schema files in
// data/schemas are generated from it (`pnpm content schemas`) and a test fails
// if they are out of step.
//
// A JSON Schema can say what shape a record has. It cannot say that an index
// points inside its own list, or count sentences. Those rules are here too,
// and only here: validate with these schemas (`pnpm content validate`), not
// with the JSON files alone.

// --- Small pieces --------------------------------------------------------------

/** ISO 3166-1 alpha-2, upper case: "US". */
const countryIso = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .describe('ISO 3166-1 alpha-2 country code, upper case.');

/** A BCP 47 language tag: "en", "pt-BR", "zh-Hans". */
const languageTag = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
  .describe('BCP 47 language tag.');

/** ISO 3166-2: the country, a hyphen, the subdivision. "DE-BY". */
const regionCode = z
  .string()
  .regex(/^[A-Z]{2}-[A-Z0-9]{1,3}$/)
  .describe('ISO 3166-2 subdivision code: a state, canton or Land.');

const httpsUrl = z
  .url()
  .regex(/^https:\/\//)
  .max(2000)
  .describe('An https address.');

const timestamp = z.iso
  .datetime({ offset: true })
  .describe('ISO 8601 date and time with a time zone, e.g. 2026-10-08T12:00:00Z.');

const text = (max: number, min = 1) => z.string().trim().min(min).max(max);

// --- Counting, for the rules a JSON Schema cannot hold ---------------------------

// A full stop after one of these is not the end of a sentence.
const ABBREVIATIONS = /(?:^|[\s(])(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|No|vs|Art|approx|etc)\.$/i;
// "U.S.", "D.C.", "e.g.", "i.e.": single letters with full stops.
const INITIALS = /(?:^|[^\p{L}])(?:\p{L}\.){1,}$/u;

/**
 * How many sentences a text has, well enough to tell two from five: it ends a
 * sentence at ". ", "! ", "? " and their equivalents in other scripts, and
 * does not at "U.S." or "Dr.". A decimal or a web address has no space after
 * its full stop, so neither does.
 */
export function countSentences(value: string): number {
  const pieces = value
    .trim()
    .split(/(?<=[.!?。！？।۔؟][”’"')\]]*)\s+|(?<=[。！？])/u)
    .filter((piece) => piece.trim() !== '');
  let count = 0;
  let carried = '';
  for (const piece of pieces) {
    const sentence = carried + piece;
    // An abbreviation's full stop: the sentence carries on into the next piece.
    if (ABBREVIATIONS.test(sentence) || INITIALS.test(sentence)) {
      carried = `${sentence} `;
      continue;
    }
    carried = '';
    count += 1;
  }
  return carried.trim() ? count + 1 : count;
}

/** Up to 24 words, by the spaces between them: "under 25 words". */
const UNDER_25_WORDS = /^\s*\S+(?:\s+\S+){0,23}\s*$/u;

// --- QuestionRecord --------------------------------------------------------------

export const questionTypes = [
  'multiple_choice',
  'multi_select',
  'true_false',
  'free_response',
] as const;
export const questionOrigins = ['official', 'original'] as const;

const questionSource = z
  .strictObject({
    title: text(300).describe('The document the question is drawn from.'),
    url: httpsUrl.describe('Where that document is published.'),
    section_or_page: text(200).describe(
      'Where in it: a section heading, a page, a question number.',
    ),
    quote_under_25_words: z
      .string()
      .max(300)
      .regex(UNDER_25_WORDS)
      .describe(
        'The words in the source that the answer rests on, copied exactly: fewer than 25 words, and at most 300 characters for scripts written without spaces.',
      ),
    publisher: text(200).describe('Who published it: the government body or its exam provider.'),
    license: text(100).describe(
      'What allows its use: "public-domain", an open licence by name, or "permission".',
    ),
  })
  .describe('The official document a question comes from.');

const option = text(300);

// What every question has, whatever its type.
const questionBase = {
  id: z.guid().describe('A UUID for the question, the same wherever it goes.'),
  country_iso: countryIso,
  exam_version: text(80).describe(
    'Which version of the exam it belongs to, as the country names it: "civics-2025".',
  ),
  topic: text(120),
  subtopic: text(120).nullable(),
  difficulty: z.int().min(1).max(5).describe('1 is the easiest, 5 the hardest.'),
  language: languageTag.describe('The language the question is written in.'),
  question: text(1000, 5),
  explanation: text(1200, 20).describe(
    'Why the answer is right, in plain language: two to four sentences.',
  ),
  source: questionSource,
  origin: z
    .enum(questionOrigins)
    .describe(
      '"official": the wording is the government\'s own published question. "original": written by Oathly from the official material.',
    ),
  region: regionCode
    .nullable()
    .describe(
      'The state, canton or Land it is asked in, where the exam varies by region; otherwise null.',
    ),
  status: z
    .literal('draft')
    .describe('A record in a file is always a draft: review happens in the app.'),
  created_at: timestamp,
  verified_at: z.null().describe('Always null in a file: only a reviewer sets it, in the app.'),
};

// The answer is written one of two ways, by type: an index into `options`
// where exactly one is right, a list of answers otherwise. Never both.
const multipleChoice = z.strictObject({
  ...questionBase,
  type: z.literal('multiple_choice'),
  options: z.array(option).min(2).max(6),
  correct_option_index: z.int().min(0).max(5).describe('Which option is right, counting from 0.'),
});

const trueFalse = z.strictObject({
  ...questionBase,
  type: z.literal('true_false'),
  options: z.array(option).length(2).describe('The two statements, e.g. "True" and "False".'),
  correct_option_index: z.int().min(0).max(1),
});

const multiSelect = z.strictObject({
  ...questionBase,
  type: z.literal('multi_select'),
  options: z.array(option).min(3).max(8),
  correct_answers: z
    .array(option)
    .min(2)
    .max(8)
    .describe('Every right option, each written exactly as it is in `options`.'),
});

const freeResponse = z.strictObject({
  ...questionBase,
  type: z.literal('free_response'),
  options: z.array(option).max(0).describe('Empty: nothing is offered to choose from.'),
  correct_answers: z
    .array(option)
    .min(1)
    .max(30)
    .describe('Every answer that is accepted, as the official material lists them.'),
});

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const questionRecordSchema = z
  .discriminatedUnion('type', [multipleChoice, trueFalse, multiSelect, freeResponse])
  .superRefine((record, context) => {
    const problem = (path: PropertyKey[], message: string) =>
      context.addIssue({ code: 'custom', path, message });

    const sentences = countSentences(record.explanation);
    if (sentences < 2 || sentences > 4) {
      problem(
        ['explanation'],
        `The explanation has ${sentences} sentence(s); it needs two to four.`,
      );
    }
    if (record.region && !record.region.startsWith(`${record.country_iso}-`)) {
      problem(['region'], `The region must be one of ${record.country_iso}'s.`);
    }
    record.options.forEach((value, index) => {
      if (record.options.findIndex((other) => same(other, value)) !== index) {
        problem(['options', index], 'Each option must be different.');
      }
    });
    if ('correct_option_index' in record) {
      if (record.correct_option_index >= record.options.length) {
        problem(['correct_option_index'], 'The right option must be one of the options.');
      }
      return;
    }
    record.correct_answers.forEach((answer, index) => {
      if (record.correct_answers.findIndex((other) => same(other, answer)) !== index) {
        problem(['correct_answers', index], 'Each answer must be different.');
      }
      if (record.type === 'multi_select' && !record.options.includes(answer)) {
        problem(
          ['correct_answers', index],
          'A right answer must be one of the options, word for word.',
        );
      }
    });
  })
  .meta({
    title: 'Question',
    description:
      'One draft question for a citizenship exam, with its source. Validate with the Zod schema: it also checks that the answer points at an option, that options differ, that the explanation is two to four sentences, and that the region belongs to the country.',
  });

export type QuestionRecord = z.infer<typeof questionRecordSchema>;

// --- CountryProfile --------------------------------------------------------------

export const examModes = ['written', 'oral', 'computer'] as const;
export const materialKinds = [
  'study_guide',
  'question_bank',
  'practice_test',
  'legislation',
  'other',
] as const;
export const reusability = ['yes', 'no', 'unclear'] as const;
export const confidenceLevels = ['high', 'medium', 'low'] as const;

/** The facts of a profile that have to be traced to a source, or explained when they cannot be. */
export const profileFields = [
  'has_exam',
  'exam_name',
  'administering_agency',
  'format',
  'languages',
  'regional_variants',
  'exemptions',
  'fee',
  'official_study_material',
] as const;
export type ProfileField = (typeof profileFields)[number];

const examFormat = z
  .strictObject({
    question_count: z.int().positive().nullable().describe('Questions asked in one sitting.'),
    pass_mark: z
      .int()
      .positive()
      .nullable()
      .describe('Correct answers needed to pass, as a number of questions.'),
    pass_percent: z
      .number()
      .min(0)
      .max(100)
      .nullable()
      .describe('The pass mark as a percentage, where that is how it is published.'),
    time_limit_minutes: z.int().positive().nullable(),
    question_pool_size: z
      .int()
      .positive()
      .nullable()
      .describe('How many published questions the exam draws from, where there is such a list.'),
    modes: z
      .array(z.enum(examModes))
      .min(1)
      .max(3)
      .describe('How it is taken: on paper, aloud with an examiner, or on a computer.'),
    notes: text(1000).nullable().describe('Rules the numbers cannot hold.'),
  })
  .describe('The exam as sat. A number the source does not fix is null.');

const studyMaterial = z.strictObject({
  title: text(300),
  url: httpsUrl,
  publisher: text(200),
  kind: z.enum(materialKinds),
  language: languageTag,
  license: text(200)
    .nullable()
    .describe('The licence or copyright statement as published; null if none could be found.'),
  reusable: z
    .enum(reusability)
    .describe('Whether the licence lets its questions or text be reused in an app.'),
});

// Where each fact comes from. A key is a field of the profile, or one part of
// it ("format.pass_mark"), so a number can carry its own source.
const fieldPath = z
  .string()
  .regex(new RegExp(`^(?:${profileFields.join('|')})(?:\\.[a-z_]+)?$`))
  .describe('A field of the profile, or one part of it: "fee", "format.pass_mark".');

export const countryProfileSchema = z
  .strictObject({
    iso: countryIso,
    name: text(100).describe("The country's name in English."),
    has_exam: z
      .boolean()
      .describe(
        'Whether naturalization requires a test of civics, knowledge of society or integration, separate from any language test.',
      ),
    exam_name: text(200).nullable().describe('What the country calls the test.'),
    administering_agency: text(200).nullable().describe('The body that sets or runs it.'),
    format: examFormat.nullable(),
    languages: z.array(languageTag).max(30).describe('The languages the test can be taken in.'),
    regional_variants: z
      .array(
        z.strictObject({
          region: regionCode,
          name: text(100),
          note: text(500).nullable().describe('What differs there.'),
        }),
      )
      .max(100)
      .describe(
        'States, cantons or Länder whose test differs. Empty when it is the same everywhere.',
      ),
    exemptions: z
      .strictObject({
        age: text(500).nullable().describe('Who is excused or treated differently by age.'),
        disability: text(500).nullable().describe('What is provided for disability or illness.'),
      })
      .describe('Who does not have to take it, or takes it differently.'),
    fee: z
      .strictObject({
        amount: z.number().nonnegative(),
        currency: z
          .string()
          .regex(/^[A-Z]{3}$/)
          .describe('ISO 4217 currency code.'),
        covers: text(300).describe(
          'What the fee pays for: the test alone, or the whole application.',
        ),
      })
      .nullable()
      .describe('The fee, where one is published.'),
    official_study_material: z.array(studyMaterial).max(50),
    last_researched_at: timestamp,

    // How far to trust it, and what it rests on.
    citations: z
      .record(fieldPath, z.array(httpsUrl).min(1).max(10))
      .describe(
        'For each fact, the official pages it was read from: government agencies, legislation, the exam provider. Never a secondary source.',
      ),
    unverified: z
      .record(fieldPath, text(500))
      .describe('For each fact left empty because no official source could confirm it: why.'),
    confidence: z.enum(confidenceLevels),
    recent_change: z
      .strictObject({
        changed_on: z.iso.date().nullable().describe('When the change took effect, if stated.'),
        summary: text(1000),
        url: httpsUrl,
      })
      .nullable()
      .describe('A change to the rules in the two years before the research, or null.'),
    notes: text(2000).nullable(),
  })
  .superRefine((profile, context) => {
    const problem = (path: PropertyKey[], message: string) =>
      context.addIssue({ code: 'custom', path, message });
    const covered = (record: Record<string, unknown>, field: ProfileField) =>
      Object.keys(record).some((key) => key === field || key.startsWith(`${field}.`));

    if (!covered(profile.citations, 'has_exam')) {
      problem(['citations'], 'Whether there is a test has to be cited.');
    }
    if (!profile.has_exam) {
      if (profile.exam_name !== null || profile.format !== null) {
        problem(['has_exam'], 'A country with no test has no test name or format.');
      }
      return;
    }
    if (profile.exam_name === null && !covered(profile.unverified, 'exam_name')) {
      problem(['exam_name'], 'A test has a name, or a reason it could not be confirmed.');
    }
    // Every fact about the test is either traced to a source or explained.
    for (const field of profileFields) {
      if (!covered(profile.citations, field) && !covered(profile.unverified, field)) {
        problem([field], `"${field}" needs a citation, or a reason under "unverified".`);
      }
    }
    for (const variant of profile.regional_variants) {
      if (!variant.region.startsWith(`${profile.iso}-`)) {
        problem(['regional_variants'], `${variant.region} is not one of ${profile.iso}'s regions.`);
      }
    }
    const format = profile.format;
    if (format?.pass_mark && format.question_count && format.pass_mark > format.question_count) {
      problem(
        ['format', 'pass_mark'],
        'The pass mark cannot be more than the number of questions.',
      );
    }
  })
  .meta({
    title: 'Country profile',
    description:
      'What a country requires of people naturalizing, by way of a civics, knowledge-of-society or integration test, with the official source of every fact. Validate with the Zod schema: it also checks that every fact is cited or explained.',
  });

export type CountryProfile = z.infer<typeof countryProfileSchema>;

// --- JSON Schema ------------------------------------------------------------------

/** The JSON Schema files, by file name, as generated from the schemas above. */
export function jsonSchemas(): Record<string, unknown> {
  const generate = (schema: z.ZodType, file: string) => ({
    ...z.toJSONSchema(schema, { target: 'draft-2020-12' }),
    $id: file,
  });
  return {
    'question.schema.json': generate(questionRecordSchema, 'question.schema.json'),
    'country-profile.schema.json': generate(countryProfileSchema, 'country-profile.schema.json'),
  };
}

/** A schema's complaints about a value, one per line, each saying where. Empty when it is valid. */
export function recordProblems(schema: z.ZodType, value: unknown): string[] {
  const parsed = schema.safeParse(value);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => {
    const where = issue.path.map(String).join('.');
    return where ? `${where}: ${issue.message}` : issue.message;
  });
}
