import {
  canAnswerAloud,
  clipTexts,
  feedbackCues,
  matchSpokenAnswer,
  promptCues,
  type AudioCue,
} from '@oathly/core';

import type { QuestionWording, SessionQuestion } from './study';

// Audio mode, the part both apps share: what to say for a question and in
// what order, and what a spoken answer means. Each app supplies an
// AudioPlatform (how to play a clip, read text aloud and listen on that
// device); everything else is here.

/** One thing to say: a recorded clip if there is one, and always the words, for the device's own voice. */
export interface SpokenItem {
  clipId: string | null;
  text: string;
  locale: string;
}

/** The learner, or their device, has refused the microphone. */
export class MicBlockedError extends Error {
  override readonly name = 'MicBlockedError';
}

export interface AudioPlatform {
  /**
   * Plays the clip, or without one reads the text in the device's voice.
   * Resolves when it has finished, could not be played, or was stopped.
   */
  speak(item: SpokenItem, signal: AbortSignal): Promise<void>;
  /**
   * Listens for one spoken answer and returns what was heard, most likely
   * reading first; empty for nothing. Left out where the device cannot
   * listen. Rejects with MicBlockedError when the microphone is refused.
   */
  listen?: (locale: string, signal: AbortSignal) => Promise<string[]>;
}

/** The short things said in the app's own language. */
export interface AudioPhrases {
  locale: string;
  correct: string;
  notQuite: string;
}

/** What audio mode needs to know about a question besides its wording. */
export interface AskedQuestion {
  type: SessionQuestion['type'];
  correctKeys: readonly string[];
}

/** Turns cues into things to say for one wording, leaving out parts with no words. */
export function cueItems(
  cues: readonly AudioCue[],
  wording: QuestionWording,
  question: AskedQuestion,
  phrases: AudioPhrases,
): SpokenItem[] {
  const texts = clipTexts({ ...wording, ...question });
  return cues.flatMap((cue): SpokenItem[] => {
    if (cue.kind === 'phrase') {
      return [{ clipId: null, text: phrases[cue.phrase], locale: phrases.locale }];
    }
    const text = texts[cue.part];
    return text === null ? [] : [{ clipId: wording.audio[cue.part], text, locale: wording.locale }];
  });
}

/** What is said when a question comes up. */
export function promptItems(
  wording: QuestionWording,
  question: AskedQuestion,
  spokenExam: boolean,
  phrases: AudioPhrases,
): SpokenItem[] {
  return cueItems(promptCues({ spokenExam }), wording, question, phrases);
}

/** What is said after a practice answer. */
export function feedbackItems(
  wording: QuestionWording,
  question: AskedQuestion,
  correct: boolean,
  phrases: AudioPhrases,
): SpokenItem[] {
  return cueItems(feedbackCues(correct), wording, question, phrases);
}

/** Says each item in turn. False if it was stopped part-way. */
export async function speakAll(
  platform: AudioPlatform,
  items: readonly SpokenItem[],
  signal: AbortSignal,
): Promise<boolean> {
  for (const item of items) {
    if (signal.aborted) return false;
    await platform.speak(item, signal);
  }
  return !signal.aborted;
}

/** Whether this question can be answered aloud on this device. */
export function canHearAnswer(platform: AudioPlatform, question: AskedQuestion): boolean {
  return platform.listen !== undefined && canAnswerAloud(question.type);
}

export type HeardAnswer =
  /** Clearly one of the options. */
  | { kind: 'answer'; key: string }
  /** Something was said, but it is not clearly any option. */
  | { kind: 'unmatched'; heard: string }
  /** Nothing was heard, or this device cannot listen. */
  | { kind: 'silence' }
  /** The microphone was refused. */
  | { kind: 'blocked' }
  /** Listening was stopped before an answer came. */
  | { kind: 'stopped' };

/**
 * Listens for an answer to a question and works out which option it was.
 * When the choices were read out numbered, "two" means the second; in a
 * spoken exam, where nothing was read out, only the answer itself counts.
 */
export async function listenForAnswer(
  platform: AudioPlatform,
  input: {
    wording: QuestionWording;
    question: AskedQuestion;
    spokenExam: boolean;
    signal: AbortSignal;
  },
): Promise<HeardAnswer> {
  const { wording, question, spokenExam, signal } = input;
  if (!platform.listen || !canAnswerAloud(question.type)) return { kind: 'silence' };
  let heard: string[];
  try {
    heard = await platform.listen(wording.locale, signal);
  } catch (error) {
    return { kind: error instanceof MicBlockedError ? 'blocked' : 'silence' };
  }
  if (signal.aborted) return { kind: 'stopped' };
  const result = matchSpokenAnswer(heard, wording.options, wording.locale, {
    byPosition: !spokenExam && question.type !== 'free_response',
  });
  if (result.kind === 'option') return { kind: 'answer', key: result.key };
  return result.kind === 'silence'
    ? { kind: 'silence' }
    : { kind: 'unmatched', heard: heard.find((reading) => reading.trim() !== '')!.trim() };
}
