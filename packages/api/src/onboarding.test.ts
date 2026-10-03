import { describe, expect, it } from 'vitest';

import { createOnboardingSchema } from './onboarding';

const schema = createOnboardingSchema(new Date('2026-10-02T12:00:00Z'));
const valid = {
  countryCode: 'US',
  examDate: '2027-03-15',
  studyLocale: 'es',
  dailyGoalMinutes: 15,
};

describe('onboarding schema', () => {
  it('accepts a complete answer and makes the country primary by default', () => {
    expect(schema.parse(valid)).toEqual({ ...valid, makePrimary: true });
  });

  it('treats the exam date as optional', () => {
    expect(schema.parse({ ...valid, examDate: null }).examDate).toBeNull();
  });

  it.each([
    [{ countryCode: 'usa' }, 'Choose a country.'],
    [{ examDate: '15/03/2027' }, 'Enter the date as year, month and day.'],
    [{ examDate: '2027-02-30' }, 'That date does not exist.'],
    [{ examDate: '2026-09-01' }, 'The exam date has already passed.'],
    [{ examDate: '2032-01-01' }, 'Choose a date within 5 years.'],
    [{ studyLocale: 'xx' }, 'Choose a language to study in.'],
  ])('rejects %j', (change, message) => {
    const result = schema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(message);
  });

  it('accepts an exam today, in case of a different time zone', () => {
    expect(schema.safeParse({ ...valid, examDate: '2026-10-02' }).success).toBe(true);
  });

  it('keeps the daily goal between 5 and 240 minutes', () => {
    expect(schema.safeParse({ ...valid, dailyGoalMinutes: 4 }).success).toBe(false);
    expect(schema.safeParse({ ...valid, dailyGoalMinutes: 241 }).success).toBe(false);
    expect(schema.safeParse({ ...valid, dailyGoalMinutes: 12.5 }).success).toBe(false);
  });
});
