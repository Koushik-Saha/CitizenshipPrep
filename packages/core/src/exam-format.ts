// zod/mini: this module reaches the browser (the study session), and the
// functional API lets the bundler keep only what is used.
import * as z from 'zod/mini';

// An exam format as the engine needs it: the numbers from exam_formats, plus
// an optional blueprint for the rules the numbers cannot express.

const name = z.string().check(z.minLength(1));

const sectionSourceSchema = z.strictObject({
  /** Only questions in these topics. */
  topics: z.optional(z.array(name)),
  /** No questions from these topics. */
  excludeTopics: z.optional(z.array(name)),
  /** Questions about the learner's own region (e.g. their Bundesland) rather than national ones. */
  regional: z.optional(z.boolean()),
});

const sectionSchema = z.strictObject({
  id: name,
  label: name,
  count: z.int().check(z.positive()),
  source: z._default(sectionSourceSchema, {}),
  /** Every question in this section must be answered correctly to pass (Australia's values questions). */
  mustAllBeCorrect: z._default(z.boolean(), false),
});

export const examBlueprintSchema = z.strictObject({
  sections: z.optional(z.array(sectionSchema).check(z.minLength(1))),
  /** The examiner stops once the result is certain (the U.S. oral civics test). */
  stopEarly: z._default(z.boolean(), false),
});

export type ExamBlueprint = z.output<typeof examBlueprintSchema>;
export type ExamSection = NonNullable<ExamBlueprint['sections']>[number];

export interface ExamFormat {
  id: string;
  name: string;
  questionCount: number | null;
  /** Correct answers needed to pass. */
  passMark: number | null;
  timeLimitMinutes: number | null;
  blueprint: ExamBlueprint;
}

export class ExamFormatError extends Error {
  override readonly name = 'ExamFormatError';
}

/** Reads a stored blueprint (JSON from the database). Null means "no special rules". */
export function parseBlueprint(value: unknown): ExamBlueprint {
  if (value == null) return examBlueprintSchema.parse({});
  const result = examBlueprintSchema.safeParse(value);
  if (!result.success) {
    throw new ExamFormatError(`Invalid exam blueprint: ${result.error.issues[0]!.message}`);
  }
  return result.data;
}

/** The sections a mock exam is built from: the blueprint's, or one section for the whole exam. */
export function examSections(format: ExamFormat): ExamSection[] {
  if (format.questionCount == null) {
    throw new ExamFormatError(`"${format.name}" has no fixed number of questions to practise.`);
  }
  const sections = format.blueprint.sections ?? [
    {
      id: 'all',
      label: format.name,
      count: format.questionCount,
      source: {},
      mustAllBeCorrect: false,
    },
  ];
  const total = sections.reduce((sum, section) => sum + section.count, 0);
  if (total !== format.questionCount) {
    throw new ExamFormatError(
      `The sections of "${format.name}" add up to ${total} questions, not ${format.questionCount}.`,
    );
  }
  return sections;
}
