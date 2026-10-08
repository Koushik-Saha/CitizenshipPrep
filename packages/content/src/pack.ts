import { z } from 'zod';

import {
  countryIso,
  countryProfileSchema,
  languageTag,
  questionRecordSchema,
  regionCode,
  text,
  timestamp,
  webUrl,
} from './records';

// A country's pack: everything gathered and written for it as files, beside
// its profile and its questions.
//
//   data/sources/<ISO>/sources.json       what was downloaded, and under what licence
//   data/content/<ISO>/flashcards.json    key facts, one per card
//   data/content/<ISO>/glossary.json      terms and what they mean
//   data/questions/<ISO>/i18n/<locale>.json   translations, each beside its original
//   data/questions/<ISO>/review.csv       the fact-checker's verdict on each question

// --- Sources -----------------------------------------------------------------------

export const licenseClasses = [
  'public_domain',
  'open_license',
  'reuse_unclear',
  'all_rights_reserved',
] as const;
export type LicenseClass = (typeof licenseClasses)[number];

export const sourceKinds = [
  'study_guide',
  'question_bank',
  'practice_test',
  'interview_questions',
  'format_page',
  'legislation',
  'other',
] as const;
export type SourceKind = (typeof sourceKinds)[number];

/** The kinds a pack has to account for: found, or looked for and not found. */
export const requiredSourceKinds = [
  'study_guide',
  'question_bank',
  'practice_test',
  'interview_questions',
  'format_page',
] as const satisfies readonly SourceKind[];

const sha256 = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .describe('SHA-256, lower-case hex.');

const license = z
  .strictObject({
    class: z
      .enum(licenseClasses)
      .describe(
        'public_domain: the law or the document says so. open_license: a named licence. all_rights_reserved: reuse needs permission. reuse_unclear: no terms found, or they do not settle it.',
      ),
    name: text(120)
      .nullable()
      .describe('The licence by name, e.g. "CC BY 4.0". Needed for open_license.'),
    commercial_use: z
      .enum(['allowed', 'not_allowed', 'unknown'])
      .describe('Whether the terms let a paid app reuse it.'),
    text: text(4000)
      .nullable()
      .describe(
        'The licence or terms-of-use wording relied on, copied exactly. Null only when none was found.',
      ),
    url: webUrl.nullable().describe('Where that wording is published.'),
  })
  .describe('What the publisher allows, as read from its own words.');

const sourceEntry = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(60)
    .describe('A short name for the source, unique in the pack: "study-guide-2025".'),
  kind: z.enum(sourceKinds),
  title: text(300),
  url: webUrl,
  publisher: text(200),
  publication_date: z.iso
    .date()
    .nullable()
    .describe('As printed on the document; null if it has none.'),
  version: text(100).nullable().describe('The edition or revision as the publisher names it.'),
  language: languageTag,
  region: regionCode.nullable().describe('For a regional variant, the region it is for.'),
  license,
  file: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/)
    .nullable()
    .describe(
      'The downloaded copy, a file in this folder. Null when it cannot be downloaded (an interactive test).',
    ),
  sha256: sha256.nullable().describe('Of the file as downloaded.'),
  text_sha256: sha256
    .nullable()
    .describe('Of the text taken from the file: steadier than the bytes for a web page.'),
  bytes: z.int().positive().nullable(),
  retrieved_at: timestamp,
  notes: text(1000).nullable(),
});

export type SourceEntry = z.infer<typeof sourceEntry>;

export const sourceManifestSchema = z
  .strictObject({
    iso: countryIso,
    researched_at: timestamp,
    sources: z.array(sourceEntry).max(200),
    not_found: z
      .array(
        z.strictObject({
          kind: z.enum(sourceKinds),
          searched: text(600).describe('Where it was looked for, and what was there instead.'),
        }),
      )
      .max(20)
      .describe('Kinds of resource that were looked for and do not exist, or could not be found.'),
  })
  .superRefine((manifest, context) => {
    const problem = (path: PropertyKey[], message: string) =>
      context.addIssue({ code: 'custom', path, message });
    const seen = { id: new Set<string>(), file: new Set<string>() };

    manifest.sources.forEach((source, index) => {
      const at = (field: string) => ['sources', index, field];
      if (seen.id.has(source.id)) problem(at('id'), `"${source.id}" is used twice.`);
      seen.id.add(source.id);
      if (source.file) {
        if (seen.file.has(source.file)) problem(at('file'), `"${source.file}" is used twice.`);
        seen.file.add(source.file);
      }
      // A downloaded copy has a hash and a size; no copy has neither.
      if (
        (source.file === null) !== (source.sha256 === null) ||
        (source.file === null) !== (source.bytes === null)
      ) {
        problem(at('file'), 'file, sha256 and bytes go together: all set, or all null.');
      }
      if (source.file === null && !source.notes) {
        problem(at('notes'), 'Say why there is no downloaded copy.');
      }
      if (source.region && !source.region.startsWith(`${manifest.iso}-`)) {
        problem(at('region'), `The region must be one of ${manifest.iso}'s.`);
      }
      const {
        class: licenseClass,
        name,
        commercial_use: commercial,
        text: wording,
        url,
      } = source.license;
      if (licenseClass === 'open_license' && !name) {
        problem(at('license'), 'An open licence has to be named.');
      }
      if (licenseClass !== 'reuse_unclear' && (!wording || !url)) {
        problem(
          at('license'),
          'Quote the wording the classification rests on, and where it is published.',
        );
      }
      if (licenseClass === 'public_domain' && commercial !== 'allowed') {
        problem(at('license'), 'Public domain allows commercial use.');
      }
      if (licenseClass === 'all_rights_reserved' && commercial === 'allowed') {
        problem(at('license'), 'If commercial reuse is allowed, it is not all rights reserved.');
      }
    });

    for (const kind of requiredSourceKinds) {
      const found = manifest.sources.some((source) => source.kind === kind);
      const looked = manifest.not_found.some((entry) => entry.kind === kind);
      if (!found && !looked) {
        problem(
          ['not_found'],
          `Nothing says whether a ${kind} exists: list one, or say where it was looked for.`,
        );
      }
    }
  })
  .meta({
    title: 'Source pack',
    description:
      'Every official study resource found for one country: where it is, what was downloaded, and what its publisher allows.',
  });

export type SourceManifest = z.infer<typeof sourceManifestSchema>;

/** Whether a source's own terms let its questions be copied into a paid app. */
export function isImportable(source: Pick<SourceEntry, 'license'>): boolean {
  const { class: licenseClass, commercial_use: commercial } = source.license;
  return (
    licenseClass === 'public_domain' ||
    (licenseClass === 'open_license' && commercial === 'allowed')
  );
}

// --- Study content -----------------------------------------------------------------

const cited = z.strictObject({
  url: webUrl,
  section_or_page: text(200),
});

export const flashcardSchema = z
  .strictObject({
    id: z.guid(),
    country_iso: countryIso,
    topic: text(120),
    subtopic: text(120).nullable(),
    language: languageTag,
    front: text(300, 3).describe('The prompt: a question or a term.'),
    back: text(600).describe('The fact, in a sentence or two.'),
    source: cited,
    needs_freshness_check: z.boolean(),
  })
  .meta({ title: 'Flashcard', description: 'One key fact, with the official page it comes from.' });

export type Flashcard = z.infer<typeof flashcardSchema>;

export const glossaryEntrySchema = z
  .strictObject({
    term: text(120),
    definition: text(800, 10),
    language: languageTag,
    topic: text(120).nullable(),
    source: cited,
  })
  .meta({
    title: 'Glossary entry',
    description: 'A term from the official material and what it means.',
  });

export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;

// --- Translations ------------------------------------------------------------------

const questionWording = z.strictObject({
  question: text(1500, 2),
  options: z.array(text(450)).max(8),
  answers: z
    .array(text(450))
    .min(1)
    .max(30)
    .describe('The right option or options, or the accepted answers.'),
  explanation: text(2000, 10),
});

const cardWording = z.strictObject({ front: text(450), back: text(900) });

const translationBase = {
  id: z.guid().describe('The id of the question or flashcard translated.'),
  locale: languageTag,
  source_language: languageTag.describe(
    'The language of the original, kept beside the translation.',
  ),
  untranslated_terms: z
    .array(
      z.strictObject({
        term: text(120).describe(
          'The original term, which stays in the translation in square brackets.',
        ),
        note: text(400).describe('Why it has no direct translation.'),
      }),
    )
    .max(20),
  status: z.literal('needs_native_review').describe('A translation waits for a native speaker.'),
  translated_at: timestamp,
};

export const translationRecordSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('question'),
      ...translationBase,
      original: questionWording,
      translation: questionWording,
    }),
    z.strictObject({
      kind: z.literal('flashcard'),
      ...translationBase,
      original: cardWording,
      translation: cardWording,
    }),
  ])
  .superRefine((entry, context) => {
    const problem = (path: PropertyKey[], message: string) =>
      context.addIssue({ code: 'custom', path, message });
    if (entry.locale === entry.source_language) {
      problem(['locale'], 'A translation is into another language.');
    }
    if (entry.kind === 'question') {
      // Nothing dropped or added: an answer is not simplified by losing an option.
      if (entry.translation.options.length !== entry.original.options.length) {
        problem(['translation', 'options'], 'The translation must keep every option.');
      }
      if (entry.translation.answers.length !== entry.original.answers.length) {
        problem(['translation', 'answers'], 'The translation must keep every answer.');
      }
    }
    const translated = JSON.stringify(entry.translation);
    entry.untranslated_terms.forEach(({ term }, index) => {
      if (!translated.includes(`[${term}]`)) {
        problem(
          ['untranslated_terms', index],
          `"[${term}]" must appear in the translation, in brackets.`,
        );
      }
    });
  })
  .meta({
    title: 'Translation',
    description: 'A question or flashcard in another language, with the original beside it.',
  });

export type Translation = z.infer<typeof translationRecordSchema>;

// --- Fact-check --------------------------------------------------------------------

/** review.csv: one line per question. Only "pass" and "fixed" go forward to a human reviewer. */
export const reviewColumns = ['id', 'verdict', 'reason'] as const;
export const reviewVerdicts = ['pass', 'fixed', 'fix', 'reject'] as const;

// --- JSON Schema -------------------------------------------------------------------

/** The JSON Schema files, by file name, as generated from the Zod schemas. */
export function jsonSchemas(): Record<string, unknown> {
  const files: Record<string, z.ZodType> = {
    'question.schema.json': questionRecordSchema,
    'country-profile.schema.json': countryProfileSchema,
    'sources.schema.json': sourceManifestSchema,
    'flashcard.schema.json': flashcardSchema,
    'glossary-entry.schema.json': glossaryEntrySchema,
    'translation.schema.json': translationRecordSchema,
  };
  return Object.fromEntries(
    Object.entries(files).map(([file, schema]) => [
      file,
      { ...z.toJSONSchema(schema, { target: 'draft-2020-12' }), $id: file },
    ]),
  );
}
