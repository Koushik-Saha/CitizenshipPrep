import type { QuestionType } from './types';

// Checks a question as learners will see it, in every language it is
// written in, for faults that make it unplayable or untrustworthy: a choice
// question without its full set of choices, a blank or repeated choice, a
// right answer that is not among the choices, no explanation, no source.
// Run over the whole bank by `pnpm content audit`.

/** Choice questions are asked with exactly this many options. */
export const CHOICE_OPTIONS = 4;

export interface CheckedOption {
  key: string;
  text: string;
}

export interface CheckedWording {
  locale: string;
  options: readonly CheckedOption[];
  explanation: string | null;
}

export interface CheckedQuestion {
  type: QuestionType;
  correctKeys: readonly string[];
  sourceUrl: string | null;
  wordings: readonly CheckedWording[];
}

export type QuestionProblemCode =
  | 'no-wording'
  | 'no-source'
  | 'no-correct-answer'
  | 'wrong-number-correct'
  | 'option-count'
  | 'empty-option'
  | 'duplicate-key'
  | 'duplicate-option'
  | 'correct-not-in-options'
  | 'accepted-answer-not-correct'
  | 'keys-differ'
  | 'no-explanation';

export interface QuestionProblem {
  code: QuestionProblemCode;
  /** The language it was found in; absent for faults of the question itself. */
  locale?: string;
  detail: string;
}

/** How many options each type needs: an exact number, or a least. */
const optionRule: Record<QuestionType, { exactly?: number; atLeast?: number }> = {
  multiple_choice: { exactly: CHOICE_OPTIONS },
  true_false: { exactly: 2 },
  multi_select: { atLeast: CHOICE_OPTIONS },
  // The accepted answers, as the official list gives them.
  free_response: { atLeast: 1 },
};

const LEADING_ARTICLE = /^(?:the|a|an)\s+/;

/**
 * An option as a learner would tell it apart from another: case, spacing,
 * punctuation and a leading English article do not make two options
 * different.
 */
export function normalizeOption(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEADING_ARTICLE, '');
}

/** Every fault found, or an empty list for a question fit to show. */
export function questionProblems(question: CheckedQuestion): QuestionProblem[] {
  const problems: QuestionProblem[] = [];
  const add = (code: QuestionProblemCode, detail: string, locale?: string) =>
    problems.push(locale ? { code, locale, detail } : { code, detail });

  if (question.wordings.length === 0) add('no-wording', 'It is written in no language.');
  if (!question.sourceUrl?.trim().startsWith('https://')) {
    add('no-source', 'It has no https:// link to its official source.');
  }

  const correct = question.correctKeys;
  if (correct.length === 0) add('no-correct-answer', 'No answer is marked right.');
  else if (
    (question.type === 'multiple_choice' || question.type === 'true_false') &&
    correct.length !== 1
  ) {
    add('wrong-number-correct', `${correct.length} answers are marked right; one must be.`);
  }

  const rule = optionRule[question.type];
  const firstKeys = question.wordings[0]?.options.map((option) => option.key).sort();

  for (const wording of question.wordings) {
    const { locale, options } = wording;
    const count = options.length;
    if (rule.exactly !== undefined && count !== rule.exactly) {
      add('option-count', `${count} option(s); a ${question.type} has ${rule.exactly}.`, locale);
    }
    if (rule.atLeast !== undefined && count < rule.atLeast) {
      add(
        'option-count',
        `${count} option(s); a ${question.type} has at least ${rule.atLeast}.`,
        locale,
      );
    }

    const keys = options.map((option) => option.key);
    if (new Set(keys).size !== keys.length)
      add('duplicate-key', 'Two options share a key.', locale);

    const seen = new Map<string, string>();
    for (const option of options) {
      const normal = normalizeOption(option.text);
      if (normal === '') {
        add('empty-option', `Option ${option.key} is blank.`, locale);
        continue;
      }
      const twin = seen.get(normal);
      if (twin !== undefined) {
        add('duplicate-option', `Options ${twin} and ${option.key} say the same thing.`, locale);
      } else {
        seen.set(normal, option.key);
      }
    }

    for (const key of correct) {
      if (!keys.includes(key)) {
        add('correct-not-in-options', `The right answer ${key} is not an option.`, locale);
      }
    }
    if (question.type === 'free_response') {
      for (const key of keys) {
        if (!correct.includes(key)) {
          add(
            'accepted-answer-not-correct',
            `Option ${key} of an open question is not marked as accepted.`,
            locale,
          );
        }
      }
    } else if (question.type === 'multi_select' && correct.length >= count && count > 0) {
      add('wrong-number-correct', 'Every option is marked right.', locale);
    }

    if (firstKeys && [...keys].sort().join('\n') !== firstKeys.join('\n')) {
      add('keys-differ', 'Its options are not the same set as in the other languages.', locale);
    }
    if (!wording.explanation?.trim()) add('no-explanation', 'It has no explanation.', locale);
  }
  return problems;
}
