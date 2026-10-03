import { describe, expect, it } from 'vitest';

import { dayKey, isValidTimeZone, minutesStudiedToday, studyStreak } from './progress';
import { at } from './test-fixtures';
import type { AnswerEvent } from './types';

const event = (questionId: string, when: string, timeMs = 60_000, correct = true): AnswerEvent => ({
  questionId,
  correct,
  timeMs,
  answeredAt: at(when),
});

describe('dayKey', () => {
  it('uses the learner’s time zone', () => {
    const lateEvening = at('2026-10-03T23:30:00Z');
    expect(dayKey(lateEvening, 'UTC')).toBe('2026-10-03');
    expect(dayKey(lateEvening, 'Europe/Berlin')).toBe('2026-10-04');
    expect(dayKey(lateEvening, 'America/Los_Angeles')).toBe('2026-10-03');
  });
});

describe('studyStreak', () => {
  const now = at('2026-10-03T18:00:00Z');

  it('counts consecutive days ending today', () => {
    const dates = [
      '2026-10-03T08:00:00Z',
      '2026-10-02T08:00:00Z',
      '2026-10-02T09:00:00Z',
      '2026-10-01T08:00:00Z',
      '2026-09-29T08:00:00Z',
    ].map(at);
    expect(studyStreak(dates, now, 'UTC')).toBe(3);
  });

  it('keeps yesterday’s streak alive until today is over', () => {
    expect(studyStreak([at('2026-10-02T08:00:00Z'), at('2026-10-01T08:00:00Z')], now, 'UTC')).toBe(
      2,
    );
  });

  it('is 0 when the last study day was before yesterday, or never', () => {
    expect(studyStreak([at('2026-09-30T08:00:00Z')], now, 'UTC')).toBe(0);
    expect(studyStreak([], now, 'UTC')).toBe(0);
  });

  it('crosses month boundaries and respects time zones', () => {
    const dates = [at('2026-10-01T06:00:00Z'), at('2026-09-30T06:00:00Z')];
    expect(studyStreak(dates, at('2026-10-01T20:00:00Z'), 'UTC')).toBe(2);
    // 23:30 UTC on the 3rd is already the 4th in Berlin.
    expect(
      studyStreak([at('2026-10-03T23:30:00Z')], at('2026-10-04T08:00:00Z'), 'Europe/Berlin'),
    ).toBe(1);
    expect(
      studyStreak([at('2026-10-03T23:30:00Z')], at('2026-10-05T08:00:00Z'), 'Europe/Berlin'),
    ).toBe(1);
    expect(
      studyStreak([at('2026-10-03T21:30:00Z')], at('2026-10-05T08:00:00Z'), 'Europe/Berlin'),
    ).toBe(0);
  });
});

describe('minutesStudiedToday', () => {
  it('adds up today’s answer times in whole minutes', () => {
    const events = [
      event('a', '2026-10-03T08:00:00Z', 90_000),
      event('b', '2026-10-03T09:00:00Z', 45_000),
      event('c', '2026-10-02T09:00:00Z', 600_000),
    ];
    expect(minutesStudiedToday(events, at('2026-10-03T20:00:00Z'), 'UTC')).toBe(2);
    expect(minutesStudiedToday([], at('2026-10-03T20:00:00Z'), 'UTC')).toBe(0);
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects anything else', () => {
    expect(isValidTimeZone('Europe/Berlin')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
