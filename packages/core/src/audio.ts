import type { QuestionType } from './types';

// Audio mode: what is said aloud for a question, and in what order. The same
// words are used to make the recorded clips ahead of time and, where a clip
// is missing, by the device's own voice, so the two never disagree.

/** The pieces of a question that can be said aloud, each its own clip. */
export const clipParts = ['question', 'options', 'answer', 'explanation'] as const;
export type ClipPart = (typeof clipParts)[number];

export interface SpokenQuestion {
  type: QuestionType;
  text: string;
  options: readonly { key: string; text: string }[];
  correctKeys: readonly string[];
  explanation: string | null;
}

const speakable = (text: string | null): string | null => {
  const tidy = (text ?? '').replace(/\s+/g, ' ').trim();
  return tidy === '' ? null : tidy;
};

/**
 * The words for each part of a question, or null where there is nothing to
 * say. Choices are numbered, so a learner can answer "two" as well as by the
 * answer itself.
 */
export function clipTexts(question: SpokenQuestion): Record<ClipPart, string | null> {
  const correct = question.options
    .filter((option) => question.correctKeys.includes(option.key))
    .map((option) => speakable(option.text))
    .filter((text) => text !== null);
  // A free-response question's options are its accepted answers: reading
  // them out would give the answer away, and one of them is enough to hear.
  const open = question.type === 'free_response';
  const choices = open ? [] : question.options.map((option) => speakable(option.text));
  return {
    question: speakable(question.text),
    options:
      choices.length > 0 && choices.every((text) => text !== null)
        ? choices.map((text, index) => `${index + 1}. ${text}`).join('\n')
        : null,
    answer: speakable((open ? correct.slice(0, 1) : correct).join('. ')),
    explanation: speakable(question.explanation),
  };
}

/**
 * What identifies a clip: the language and the exact words. The server and
 * the content pipeline hash this (SHA-256) to name the recording, so the same
 * words in the same language are recorded once however many questions use
 * them.
 */
export function clipKey(locale: string, text: string): string {
  return `${locale}\n${text}`;
}

/** Something to play: a clip of the current question, or a short phrase in the app's language. */
export type AudioCue =
  { kind: 'clip'; part: ClipPart } | { kind: 'phrase'; phrase: 'correct' | 'notQuite' };

/**
 * What to play when a question comes up: the question, then its choices. In
 * a spoken exam (an interview) the examiner asks and waits; nobody reads out
 * choices.
 */
export function promptCues(options: { spokenExam: boolean }): AudioCue[] {
  return options.spokenExam
    ? [{ kind: 'clip', part: 'question' }]
    : [
        { kind: 'clip', part: 'question' },
        { kind: 'clip', part: 'options' },
      ];
}

/** What to play after a practice answer: the verdict, the right answer if it was missed, and why. */
export function feedbackCues(correct: boolean): AudioCue[] {
  return correct
    ? [
        { kind: 'phrase', phrase: 'correct' },
        { kind: 'clip', part: 'explanation' },
      ]
    : [
        { kind: 'phrase', phrase: 'notQuite' },
        { kind: 'clip', part: 'answer' },
        { kind: 'clip', part: 'explanation' },
      ];
}

/** Whether a question can be answered aloud: any with a single answer to say. */
export function canAnswerAloud(type: QuestionType): boolean {
  return type !== 'multi_select';
}
