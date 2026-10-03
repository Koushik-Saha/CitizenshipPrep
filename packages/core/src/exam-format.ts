import { z } from 'zod';

// An exam format as the engine needs it: the numbers from exam_formats, plus
// an optional blueprint for the rules the numbers cannot express.

const sectionSourceSchema = z
  .object({
    /** Only questions in these topics. */
    topics: z.array(z.string().min(1)).optional(),
    /** No questions from these topics. */
    excludeTopics: z.array(z.string().min(1)).optional(),
    /** Questions about the learner's own region (e.g. their Bundesland) rather than national ones. */
    regional: z.boolean().optional(),
  })
  .strict();

const sectionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    count: z.number().int().positive(),
    source: sectionSourceSchema.default({}),
    /** Every question in this section must be answered correctly to pass (Australia's values questions). */
    mustAllBeCorrect: z.boolean().default(false),
  })
  .strict();

export const examBlueprintSchema = z
  .object({
    sections: z.array(sectionSchema).min(1).optional(),
    /** The examiner stops once the result is certain (the U.S. oral civics test). */
    stopEarly: z.boolean().default(false),
  })
  .strict();

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
