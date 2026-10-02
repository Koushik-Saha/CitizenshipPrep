import { z } from 'zod';

import { quoteAppearsIn, slugify } from './text';

export const optionKeys = ['a', 'b', 'c', 'd'] as const;
export type OptionKey = (typeof optionKeys)[number];

// What the model is asked to return. Structured outputs cannot express length
// or range limits, so those are enforced afterwards by checkDraft().
export const draftQuestionSchema = z.object({
  text: z.string(),
  options: z.object({ a: z.string(), b: z.string(), c: z.string(), d: z.string() }),
  correct: z.enum(optionKeys),
  explanation: z.string(),
  source_quote: z.string(),
  topic: z.object({ slug: z.string(), name: z.string() }),
  difficulty: z.number(),
});

export const draftResponseSchema = z.object({ questions: z.array(draftQuestionSchema) });

export type DraftQuestion = z.infer<typeof draftQuestionSchema>;

export const translationSchema = z.object({
  text: z.string(),
  options: z.array(z.object({ key: z.string(), text: z.string() })),
  explanation: z.string(),
});

export type TranslationDraft = z.infer<typeof translationSchema>;

export interface QuestionOption {
  key: string;
  text: string;
}

export interface CheckedDraft {
  text: string;
  options: QuestionOption[];
  correctKey: OptionKey;
  explanation: string;
  sourceQuote: string;
  topic: { slug: string; name: string };
  difficulty: number;
}

export type DraftCheck = { ok: true; draft: CheckedDraft } | { ok: false; problems: string[] };

/** Everything a draft must satisfy before it is worth a reviewer's time. */
export function checkDraft(draft: DraftQuestion, passageText: string): DraftCheck {
  const problems: string[] = [];
  const text = draft.text.trim();
  const explanation = draft.explanation.trim();
  const sourceQuote = draft.source_quote.trim();
  const options = optionKeys.map((key) => ({ key, text: draft.options[key].trim() }));

  if (text.length < 10 || text.length > 500)
    problems.push('question text must be 10-500 characters');
  if (options.some((option) => !option.text)) problems.push('every option needs text');
  if (options.some((option) => option.text.length > 300))
    problems.push('an option is over 300 characters');
  const distinct = new Set(options.map((option) => option.text.toLowerCase()));
  if (distinct.size !== options.length) problems.push('options must all be different');
  if (explanation.length < 10 || explanation.length > 1200) {
    problems.push('explanation must be 10-1200 characters');
  }
  if (!Number.isInteger(draft.difficulty) || draft.difficulty < 1 || draft.difficulty > 5) {
    problems.push('difficulty must be a whole number from 1 to 5');
  }
  if (!sourceQuote) {
    problems.push('source quote is missing');
  } else if (sourceQuote.length > 2000) {
    problems.push('source quote is over 2000 characters');
  } else if (!quoteAppearsIn(passageText, sourceQuote)) {
    problems.push('source quote does not appear in the passage');
  }
  const slug = slugify(draft.topic.slug || draft.topic.name);
  const topicName = draft.topic.name.trim();
  if (!slug || !topicName || topicName.length > 120) problems.push('topic needs a slug and a name');

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    draft: {
      text,
      options,
      correctKey: draft.correct,
      explanation,
      sourceQuote,
      topic: { slug, name: topicName },
      difficulty: draft.difficulty,
    },
  };
}

export type TranslationCheck =
  | { ok: true; translation: { text: string; options: QuestionOption[]; explanation: string } }
  | { ok: false; problems: string[] };

/** A translation must keep exactly the option keys of the wording it was made from. */
export function checkTranslation(
  translation: TranslationDraft,
  sourceOptions: readonly QuestionOption[],
): TranslationCheck {
  const problems: string[] = [];
  const text = translation.text.trim();
  const explanation = translation.explanation.trim();
  if (text.length < 1 || text.length > 2000)
    problems.push('question text must be 1-2000 characters');
  if (explanation.length > 4000) problems.push('explanation is over 4000 characters');

  const byKey = new Map(translation.options.map((option) => [option.key, option.text.trim()]));
  const options: QuestionOption[] = [];
  for (const source of sourceOptions) {
    const translated = byKey.get(source.key);
    if (!translated) problems.push(`option "${source.key}" is missing`);
    else options.push({ key: source.key, text: translated });
  }
  if (byKey.size !== sourceOptions.length) problems.push('options do not match the original');

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, translation: { text, options, explanation } };
}
