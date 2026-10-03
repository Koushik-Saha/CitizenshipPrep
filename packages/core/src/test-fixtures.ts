import type { QuizQuestion } from './types';

/** A question with sensible defaults; override what the test is about. */
export function question(id: string, overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id,
    topicId: 'topic-government',
    topicSlug: 'government',
    difficulty: 2,
    type: 'multiple_choice',
    correctKeys: ['a'],
    regionCode: null,
    version: 1,
    ...overrides,
  };
}

/** `count` questions in one topic, ids `${prefix}-0` onwards. */
export function questions(
  prefix: string,
  count: number,
  overrides: Partial<QuizQuestion> = {},
): QuizQuestion[] {
  return Array.from({ length: count }, (_, i) => question(`${prefix}-${i}`, overrides));
}

export const at = (iso: string) => new Date(iso);
