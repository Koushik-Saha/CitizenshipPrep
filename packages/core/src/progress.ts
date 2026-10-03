import type { AnswerEvent } from './types';

// Dashboard numbers: the study streak and today's minutes. Days are counted
// in the learner's own time zone.

/** The calendar day of `date` in `timeZone`, as YYYY-MM-DD. */
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function previousDay(key: string): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Days in a row with at least one answer, ending today. A streak that ended
 * yesterday still counts until the end of today, so it does not reset before
 * the learner has had a chance to study.
 */
export function studyStreak(answeredAt: readonly Date[], now: Date, timeZone: string): number {
  const days = new Set(answeredAt.map((date) => dayKey(date, timeZone)));
  let day = dayKey(now, timeZone);
  if (!days.has(day)) day = previousDay(day);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = previousDay(day);
  }
  return streak;
}

/** Whole minutes spent answering today, from the time each answer took. */
export function minutesStudiedToday(
  events: readonly AnswerEvent[],
  now: Date,
  timeZone: string,
): number {
  const today = dayKey(now, timeZone);
  const ms = events
    .filter((event) => dayKey(event.answeredAt, timeZone) === today)
    .reduce((sum, event) => sum + event.timeMs, 0);
  return Math.floor(ms / 60_000);
}

/** True for a time zone name the runtime knows, e.g. "Europe/Berlin". */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}
