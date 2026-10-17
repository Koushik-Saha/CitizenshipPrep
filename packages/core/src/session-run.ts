import type { MockExam } from './mock-exam';
import { examDecision, isCorrect, scoreAttempt } from './scoring';
import type { Answer, QuizQuestion } from './types';

// Running a study session, as a pure state machine: practice (answer, see
// whether it was right, move on), flashcards (flip, say whether you knew it)
// and mock exams (no feedback, a clock, and for some exams an early stop).
// Apps render the state and feed it events; they own the clock and storage.

export type RunMode = 'practice' | 'flashcards' | 'mock_exam';
export type RunPhase = 'answering' | 'feedback' | 'results';

/** Why the session ended. */
export type StopReason = 'finished' | 'passed-early' | 'failed-early' | 'time-up';

export interface GivenAnswer extends Answer {
  correct: boolean;
}

export interface RunConfig {
  mode: RunMode;
  /** In the order they are asked. */
  questions: readonly QuizQuestion[];
  /** Set for a mock exam. */
  exam: MockExam | null;
}

export interface RunState {
  /** Position in `questions`. */
  index: number;
  /** Option keys chosen for the current question, not yet submitted. */
  selected: readonly string[];
  phase: RunPhase;
  /** Flashcards: whether the answer side is showing. */
  flipped: boolean;
  answers: readonly GivenAnswer[];
  stopReason: StopReason | null;
}

export function startRun(options: { completed?: boolean } = {}): RunState {
  return {
    index: 0,
    selected: [],
    phase: options.completed ? 'results' : 'answering',
    flipped: false,
    answers: [],
    stopReason: options.completed ? 'finished' : null,
  };
}

const current = (config: RunConfig, state: RunState): QuizQuestion =>
  config.questions[state.index]!;

/**
 * Whether the learner marks the question themselves: they answer, turn it
 * over to see the answer, and say whether they had it. True for every
 * flashcard, and for a question answered in the learner's own words
 * (free_response): its options are the accepted answers, every one of them
 * right, so they cannot be offered as choices.
 */
export function isSelfMarked(mode: RunMode, question: Pick<QuizQuestion, 'type'>): boolean {
  return mode === 'flashcards' || question.type === 'free_response';
}

/**
 * The keys to record for a learner's own verdict. A flashcard records none.
 * An open question records the first accepted answer when they had it and
 * none when they did not, so scoring the keys gives the same verdict.
 */
export function selfMarkedKeys(
  mode: RunMode,
  question: Pick<QuizQuestion, 'type' | 'correctKeys'>,
  knewIt: boolean,
): string[] {
  if (mode === 'flashcards' || !knewIt) return [];
  return question.correctKeys.slice(0, 1);
}

/** Chooses an option: the only one for single-answer questions, on or off for multi-select. */
export function toggleOption(config: RunConfig, state: RunState, key: string): RunState {
  if (state.phase !== 'answering' || isSelfMarked(config.mode, current(config, state))) {
    return state;
  }
  const selected =
    current(config, state).type === 'multi_select'
      ? state.selected.includes(key)
        ? state.selected.filter((value) => value !== key)
        : [...state.selected, key]
      : [key];
  return { ...state, selected };
}

/** Turns a flashcard, or an open question, over to show its answer. */
export function flipCard(config: RunConfig, state: RunState): RunState {
  if (!isSelfMarked(config.mode, current(config, state)) || state.phase !== 'answering') {
    return state;
  }
  return { ...state, flipped: true };
}

function advance(config: RunConfig, state: RunState): RunState {
  const done = state.index + 1 >= config.questions.length;
  return done
    ? { ...state, selected: [], flipped: false, phase: 'results', stopReason: 'finished' }
    : { ...state, index: state.index + 1, selected: [], flipped: false, phase: 'answering' };
}

/** Longest time credited to one answer; beyond this the learner walked away. */
export const MAX_ANSWER_MS = 10 * 60_000;

export interface SubmitOptions {
  now: Date;
  /** When the question was shown, in ms since the epoch. */
  shownAt: number;
  /**
   * The learner's own verdict, for a question they mark themselves (see
   * isSelfMarked): a flashcard, or an open question once turned over.
   */
  knewIt?: boolean;
  /**
   * An answer given aloud, in place of the options chosen on screen: the
   * option it was heard as, or none when it matched no option (which is a
   * wrong answer, not a missing one).
   */
  spoken?: readonly string[];
}

/**
 * Submits the current question. Practice moves to feedback; flashcards, a
 * learner's own verdict (they have just seen the answer) and exams move
 * straight on (a real exam does not say whether you were right), and an exam
 * that stops early ends as soon as its result is certain.
 * Returns the new state and the answer to record, or null if nothing was
 * submitted (nothing chosen, or not the moment for it).
 */
export function submitAnswer(
  config: RunConfig,
  state: RunState,
  options: SubmitOptions,
): { state: RunState; answer: GivenAnswer | null } {
  if (state.phase !== 'answering') return { state, answer: null };
  const question = current(config, state);
  const isFlashcards = config.mode === 'flashcards';
  const selfMarked = isSelfMarked(config.mode, question);
  // An open question said aloud is marked like one chosen on screen; the
  // learner's verdict counts only for a question they mark themselves.
  const spoken = isFlashcards ? undefined : options.spoken;
  const verdict = selfMarked && !spoken ? options.knewIt : undefined;
  let selectedKeys: string[];
  if (verdict !== undefined) selectedKeys = selfMarkedKeys(config.mode, question, verdict);
  // Said aloud and matching no option is a wrong answer, not a missing one.
  else if (spoken) selectedKeys = [...spoken];
  // Nothing chosen, or no verdict where one is needed, is not an answer.
  else if (selfMarked || state.selected.length === 0) return { state, answer: null };
  else selectedKeys = [...state.selected];
  const answer: GivenAnswer = {
    questionId: question.id,
    selectedKeys,
    timeMs: Math.min(Math.max(0, options.now.getTime() - options.shownAt), MAX_ANSWER_MS),
    answeredAt: options.now,
    correct: isFlashcards ? verdict! : isCorrect(question, selectedKeys),
  };
  const answered: RunState = { ...state, answers: [...state.answers, answer] };

  if (config.mode === 'practice' && verdict === undefined) {
    return { state: { ...answered, phase: 'feedback' }, answer };
  }
  if (config.mode === 'mock_exam' && config.exam?.stopEarly) {
    const decision = examDecision(config.exam, config.questions, answered.answers);
    if (decision) {
      return {
        state: {
          ...answered,
          selected: [],
          phase: 'results',
          stopReason: decision === 'passed' ? 'passed-early' : 'failed-early',
        },
        answer,
      };
    }
  }
  return { state: advance(config, answered), answer };
}

/** Practice: leaves the feedback for the next question, or the results. */
export function nextQuestion(config: RunConfig, state: RunState): RunState {
  return state.phase === 'feedback' ? advance(config, state) : state;
}

/** The exam clock ran out. */
export function timeUp(state: RunState): RunState {
  if (state.phase === 'results') return state;
  return { ...state, selected: [], flipped: false, phase: 'results', stopReason: 'time-up' };
}

export interface RunResult {
  correct: number;
  total: number;
  /** For a mock exam: whether it was a pass. Null for practice and flashcards. */
  passed: boolean | null;
}

/** The result to store when the session ends. `startedAt` is what the exam clock runs from. */
export function runResult(config: RunConfig, state: RunState, startedAt: Date): RunResult {
  const correct = state.answers.filter((answer) => answer.correct).length;
  const total = config.questions.length;
  if (config.mode !== 'mock_exam' || !config.exam) return { correct, total, passed: null };
  const score = scoreAttempt(config.questions, state.answers, { exam: config.exam, startedAt });
  return { correct: score.correct, total, passed: score.exam!.passed };
}

/** When a timed exam ends, in ms since the epoch; null when there is no clock. */
export function runDeadline(config: RunConfig, startedAt: Date): number | null {
  return config.exam?.timeLimitMs != null ? startedAt.getTime() + config.exam.timeLimitMs : null;
}
