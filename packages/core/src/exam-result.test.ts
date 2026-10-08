import { describe, expect, it } from 'vitest';

import { hasPassedExam, isExamOutcome, shouldAskExamResult } from './exam-result';

const today = '2026-10-08';
const none = { examResult: null, examResultAt: null };

describe('isExamOutcome', () => {
  it('knows passed and failed, and nothing else', () => {
    expect(isExamOutcome('passed')).toBe(true);
    expect(isExamOutcome('failed')).toBe(true);
    expect(isExamOutcome('excellent')).toBe(false);
    expect(isExamOutcome(null)).toBe(false);
  });
});

describe('shouldAskExamResult', () => {
  it('asks once the exam date has come', () => {
    expect(shouldAskExamResult({ examDate: '2026-10-07', ...none }, today)).toBe(true);
    expect(shouldAskExamResult({ examDate: today, ...none }, today)).toBe(true);
  });

  it('does not ask before the date, or when none is set', () => {
    expect(shouldAskExamResult({ examDate: '2026-10-09', ...none }, today)).toBe(false);
    expect(shouldAskExamResult({ examDate: null, ...none }, today)).toBe(false);
  });

  it('does not ask again once the learner has said', () => {
    const reported = { examDate: '2026-10-01', examResultAt: '2026-10-02T09:00:00.000Z' };
    expect(shouldAskExamResult({ ...reported, examResult: 'passed' }, today)).toBe(false);
    expect(shouldAskExamResult({ ...reported, examResult: 'failed' }, today)).toBe(false);
  });

  it('asks again after a retake: a fail reported before the new date', () => {
    const retake = { examResult: 'failed' as const, examResultAt: '2026-09-02T09:00:00.000Z' };
    expect(shouldAskExamResult({ examDate: '2026-10-05', ...retake }, today)).toBe(true);
    // The new date has not come yet.
    expect(shouldAskExamResult({ examDate: '2026-11-05', ...retake }, today)).toBe(false);
    // A pass is final, whatever the date says.
    expect(
      shouldAskExamResult({ examDate: '2026-10-05', ...retake, examResult: 'passed' }, today),
    ).toBe(false);
  });

  it('asks when a result has lost its date', () => {
    expect(
      shouldAskExamResult(
        { examDate: '2026-10-01', examResult: 'failed', examResultAt: null },
        today,
      ),
    ).toBe(true);
  });
});

describe('hasPassedExam', () => {
  it('is true only for a reported pass', () => {
    expect(hasPassedExam({ examResult: 'passed' })).toBe(true);
    expect(hasPassedExam({ examResult: 'failed' })).toBe(false);
    expect(hasPassedExam({ examResult: null })).toBe(false);
  });
});
