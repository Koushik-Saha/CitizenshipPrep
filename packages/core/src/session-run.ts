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

/** Chooses an option: the only one for single-answer questions, on or off for multi-select. */
export function toggleOption(config: RunConfig, state: RunState, key: string): RunState {
  if (state.phase !== 'answering' || config.mode === 'flashcards') return state;
  const selected =
    current(config, state).type === 'multi_select'
      ? state.selected.includes(key)
        ? state.selected.filter((value) => value !== key)
        : [...state.selected, key]
      : [key];
  return { ...state, selected };
}

/** Turns a flashcard over to show its answer. */
export function flipCard(config: RunConfig, state: RunState): RunState {
  if (config.mode !== 'flashcards' || state.phase !== 'answering') return state;
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
  /** Flashcards: the learner's own verdict, since there is nothing to mark. */
  knewIt?: boolean;
}

/**
 * Submits the current question. Practice moves to feedback; flashcards and
 * exams move straight on (a real exam does not say whether you were right),
 * and an exam that stops early ends as soon as its result is certain.
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
  if (isFlashcards ? options.knewIt === undefined : state.selected.length === 0) {
    return { state, answer: null };
  }
  const selectedKeys = isFlashcards ? [] : [...state.selected];
  const answer: GivenAnswer = {
    questionId: question.id,
    selectedKeys,
    timeMs: Math.min(Math.max(0, options.now.getTime() - options.shownAt), MAX_ANSWER_MS),
    answeredAt: options.now,
    correct: isFlashcards ? options.knewIt! : isCorrect(question, selectedKeys),
  };
  const answered: RunState = { ...state, answers: [...state.answers, answer] };

  if (config.mode === 'practice') return { state: { ...answered, phase: 'feedback' }, answer };
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
