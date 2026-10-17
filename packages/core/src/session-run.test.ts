import { describe, expect, it } from 'vitest';

import type { MockExam } from './mock-exam';
import {
  flipCard,
  isSelfMarked,
  MAX_ANSWER_MS,
  nextQuestion,
  runDeadline,
  runResult,
  selfMarkedKeys,
  startRun,
  submitAnswer,
  timeUp,
  toggleOption,
  type RunConfig,
  type RunState,
} from './session-run';
import { at, question, questions } from './test-fixtures';

const startedAt = at('2026-10-03T10:00:00Z');
const later = (seconds: number) => new Date(startedAt.getTime() + seconds * 1000);
const pool = questions('q', 4);

const exam = (overrides: Partial<MockExam> = {}): MockExam => ({
  formatId: 'f',
  questionIds: pool.map((q) => q.id),
  sections: [
    { id: 'all', label: 'All', questionIds: pool.map((q) => q.id), mustAllBeCorrect: false },
  ],
  questionCount: 4,
  passMark: 3,
  timeLimitMs: null,
  stopEarly: false,
  ...overrides,
});

const practice: RunConfig = { mode: 'practice', questions: pool, exam: null };
const flashcards: RunConfig = { mode: 'flashcards', questions: pool, exam: null };
const mock = (overrides: Partial<MockExam> = {}): RunConfig => ({
  mode: 'mock_exam',
  questions: pool,
  exam: exam(overrides),
});

/** Chooses `key` and submits, `seconds` after the session started. */
function answer(config: RunConfig, state: RunState, key: string, seconds = 5) {
  return submitAnswer(config, toggleOption(config, state, key), {
    now: later(seconds),
    shownAt: later(seconds - 3).getTime(),
  });
}

describe('practice', () => {
  it('shows feedback after each answer, then moves on, then finishes', () => {
    let state = startRun();
    expect(state).toMatchObject({ index: 0, phase: 'answering', stopReason: null });

    // Nothing chosen: nothing happens.
    expect(submitAnswer(practice, state, { now: later(1), shownAt: 0 })).toEqual({
      state,
      answer: null,
    });

    const first = answer(practice, state, 'a');
    expect(first.answer).toMatchObject({ questionId: 'q-0', correct: true, timeMs: 3000 });
    expect(first.state.phase).toBe('feedback');
    // Choices are locked while the feedback shows.
    expect(toggleOption(practice, first.state, 'b')).toBe(first.state);
    expect(submitAnswer(practice, first.state, { now: later(9), shownAt: 0 }).answer).toBeNull();

    state = nextQuestion(practice, first.state);
    expect(state).toMatchObject({ index: 1, phase: 'answering', selected: [] });
    expect(nextQuestion(practice, state)).toBe(state);

    for (const key of ['b', 'a', 'a'])
      state = nextQuestion(practice, answer(practice, state, key).state);
    expect(state).toMatchObject({ phase: 'results', stopReason: 'finished' });
    expect(runResult(practice, state, startedAt)).toEqual({ correct: 3, total: 4, passed: null });
  });

  it('changes a single choice, and toggles choices on multi-select questions', () => {
    const state = toggleOption(practice, toggleOption(practice, startRun(), 'a'), 'b');
    expect(state.selected).toEqual(['b']);

    const multi: RunConfig = {
      ...practice,
      questions: [question('m', { type: 'multi_select', correctKeys: ['a', 'c'] })],
    };
    let picked = startRun();
    for (const key of ['a', 'b', 'c', 'b']) picked = toggleOption(multi, picked, key);
    expect(picked.selected).toEqual(['a', 'c']);
    const done = submitAnswer(multi, picked, { now: later(5), shownAt: later(1).getTime() });
    expect(done.answer?.correct).toBe(true);
  });

  it('caps the time credited to one answer, and never goes negative', () => {
    const slow = submitAnswer(practice, toggleOption(practice, startRun(), 'a'), {
      now: later(3600),
      shownAt: startedAt.getTime(),
    });
    expect(slow.answer?.timeMs).toBe(MAX_ANSWER_MS);
    const skewed = submitAnswer(practice, toggleOption(practice, startRun(), 'a'), {
      now: startedAt,
      shownAt: later(5).getTime(),
    });
    expect(skewed.answer?.timeMs).toBe(0);
  });
});

describe('spoken answers', () => {
  it('takes an answer given aloud in place of the options chosen on screen', () => {
    // Something else was tapped first: what was said is the answer.
    const tapped = toggleOption(practice, startRun(), 'b');
    const said = submitAnswer(practice, tapped, { now: later(4), shownAt: 0, spoken: ['a'] });
    expect(said.answer).toMatchObject({ selectedKeys: ['a'], correct: true });
    expect(said.state.phase).toBe('feedback');
  });

  it('counts something said that matched no option as a wrong answer, not a missing one', () => {
    const said = submitAnswer(mock(), startRun(), { now: later(4), shownAt: 0, spoken: [] });
    expect(said.answer).toMatchObject({ selectedKeys: [], correct: false });
    expect(said.state.index).toBe(1);
    // Nothing tapped and nothing said is still not an answer.
    expect(submitAnswer(mock(), startRun(), { now: later(4), shownAt: 0 }).answer).toBeNull();
  });
});

describe('flashcards', () => {
  it('flips, takes the learner’s own verdict, and moves straight on', () => {
    let state = startRun();
    expect(toggleOption(flashcards, state, 'a')).toBe(state);
    // A verdict is needed.
    expect(submitAnswer(flashcards, state, { now: later(1), shownAt: 0 }).answer).toBeNull();

    state = flipCard(flashcards, state);
    expect(state.flipped).toBe(true);
    const knew = submitAnswer(flashcards, state, {
      now: later(4),
      shownAt: later(1).getTime(),
      knewIt: true,
    });
    expect(knew.answer).toMatchObject({ correct: true, selectedKeys: [] });
    expect(knew.state).toMatchObject({ index: 1, flipped: false, phase: 'answering' });

    state = knew.state;
    for (const knewIt of [false, true, false]) {
      state = submitAnswer(flashcards, state, { now: later(9), shownAt: 0, knewIt }).state;
    }
    expect(state.phase).toBe('results');
    expect(runResult(flashcards, state, startedAt)).toEqual({ correct: 2, total: 4, passed: null });
    expect(flipCard(flashcards, state)).toBe(state);
    expect(flipCard(practice, startRun())).toEqual(startRun());
  });
});

describe('open questions (answered in the learner’s own words)', () => {
  // The options are the accepted answers, all of them right.
  const open = question('o', { type: 'free_response', correctKeys: ['a', 'b'] });
  const openPractice: RunConfig = { mode: 'practice', questions: [open, pool[0]!], exam: null };
  const openExam: RunConfig = {
    mode: 'mock_exam',
    questions: [open, ...pool.slice(0, 3)],
    exam: exam({ questionIds: ['o', 'q-0', 'q-1', 'q-2'], stopEarly: true, passMark: 3 }),
  };

  it('cannot be answered by picking an accepted answer: it is turned over and self-marked', () => {
    expect(isSelfMarked('practice', open)).toBe(true);
    expect(isSelfMarked('practice', pool[0]!)).toBe(false);
    let state = startRun();
    expect(toggleOption(openPractice, state, 'a')).toBe(state);
    expect(submitAnswer(openPractice, state, { now: later(1), shownAt: 0 }).answer).toBeNull();

    state = flipCard(openPractice, state);
    expect(state.flipped).toBe(true);
    const knew = submitAnswer(openPractice, state, { now: later(4), shownAt: 0, knewIt: true });
    // Recorded as an accepted answer, so scoring the keys agrees with the verdict.
    expect(knew.answer).toMatchObject({ selectedKeys: ['a'], correct: true });
    // The answer was just seen: no feedback step, straight on.
    expect(knew.state).toMatchObject({ index: 1, phase: 'answering', flipped: false });
    // The next question is an ordinary choice again.
    expect(flipCard(openPractice, knew.state)).toBe(knew.state);
  });

  it('records a miss as no answer given, and scores it wrong', () => {
    const missed = submitAnswer(openPractice, flipCard(openPractice, startRun()), {
      now: later(4),
      shownAt: 0,
      knewIt: false,
    });
    expect(missed.answer).toMatchObject({ selectedKeys: [], correct: false });
    expect(selfMarkedKeys('practice', open, false)).toEqual([]);
    expect(selfMarkedKeys('flashcards', open, true)).toEqual([]);
  });

  it('still takes an answer said aloud, marked against the accepted answers', () => {
    const said = submitAnswer(openPractice, startRun(), {
      now: later(4),
      shownAt: 0,
      spoken: ['b'],
      knewIt: false,
    });
    expect(said.answer).toMatchObject({ selectedKeys: ['b'], correct: true });
    expect(said.state.phase).toBe('feedback');
  });

  it('counts self-marked answers in a mock exam, including stopping early', () => {
    let state = submitAnswer(openExam, flipCard(openExam, startRun()), {
      now: later(4),
      shownAt: 0,
      knewIt: true,
    }).state;
    expect(state).toMatchObject({ index: 1, phase: 'answering' });
    for (const key of ['a', 'a']) state = answer(openExam, state, key).state;
    expect(state).toMatchObject({ phase: 'results', stopReason: 'passed-early' });
    expect(runResult(openExam, state, startedAt)).toEqual({ correct: 3, total: 4, passed: true });
  });
});

describe('mock exams', () => {
  it('gives no feedback, and is passed or failed at the end', () => {
    let state = startRun();
    const first = answer(mock(), state, 'a');
    expect(first.state).toMatchObject({ index: 1, phase: 'answering' });
    state = first.state;
    for (const key of ['a', 'b', 'a']) state = answer(mock(), state, key).state;
    expect(state).toMatchObject({ phase: 'results', stopReason: 'finished' });
    expect(runResult(mock(), state, startedAt)).toEqual({ correct: 3, total: 4, passed: true });

    let failing = startRun();
    for (const key of ['b', 'b', 'a', 'a']) failing = answer(mock(), failing, key).state;
    expect(runResult(mock(), failing, startedAt)).toEqual({ correct: 2, total: 4, passed: false });
  });

  it('stops early once the result is certain, where the exam does', () => {
    const config = mock({ stopEarly: true });
    let state = startRun();
    for (const key of ['a', 'a']) state = answer(config, state, key).state;
    expect(state.phase).toBe('answering');
    state = answer(config, state, 'a').state;
    expect(state).toMatchObject({ phase: 'results', stopReason: 'passed-early', index: 2 });
    expect(runResult(config, state, startedAt)).toEqual({ correct: 3, total: 4, passed: true });

    let failing = startRun();
    for (const key of ['b', 'b']) failing = answer(config, failing, key).state;
    expect(failing).toMatchObject({ phase: 'results', stopReason: 'failed-early' });
  });

  it('ends when the clock runs out, counting only answers given in time', () => {
    const config = mock({ timeLimitMs: 60_000 });
    expect(runDeadline(config, startedAt)).toBe(later(60).getTime());
    expect(runDeadline(practice, startedAt)).toBeNull();

    let state = startRun();
    for (const key of ['a', 'a']) state = answer(config, state, key, 30).state;
    state = timeUp(toggleOption(config, state, 'a'));
    expect(state).toMatchObject({ phase: 'results', stopReason: 'time-up', selected: [] });
    expect(timeUp(state)).toBe(state);
    expect(runResult(config, state, startedAt)).toEqual({ correct: 2, total: 4, passed: false });
  });
});

describe('startRun', () => {
  it('opens a session that was already finished on its results', () => {
    expect(startRun({ completed: true })).toMatchObject({
      phase: 'results',
      stopReason: 'finished',
    });
  });

  it('scores a mock exam config that has lost its exam like practice', () => {
    const config: RunConfig = { mode: 'mock_exam', questions: pool, exam: null };
    let state = startRun();
    for (const key of ['a', 'a', 'a', 'a']) state = answer(config, state, key).state;
    expect(runResult(config, state, startedAt)).toEqual({ correct: 4, total: 4, passed: null });
  });
});
