import { describe, expect, it } from 'vitest';

import { daysUntilExam, nextStep, primaryCountry, type Me } from './me';

const base: Me = {
  profile: { id: 'user-1', displayName: 'Ana' },
  settings: null,
  studyCountries: [],
  progress: { attempts: 0, questionsAnswered: 0, correctAnswers: 0 },
  entitlements: [],
};
const us = {
  countryCode: 'US',
  countryName: 'United States',
  examDate: '2026-10-12',
  studyLocale: 'es',
  isPrimary: false,
};
const ca = { ...us, countryCode: 'CA', countryName: 'Canada', examDate: null, isPrimary: true };

describe('nextStep', () => {
  it('sends a new learner to onboarding', () => {
    expect(nextStep(base)).toBe('onboarding');
  });

  it('sends a learner who has chosen a country to study', () => {
    expect(
      nextStep({
        ...base,
        settings: { dailyGoalMinutes: 15, onboardedAt: '2026-10-02T00:00:00Z' },
        studyCountries: [us],
      }),
    ).toBe('study');
  });

  it('sends them back to onboarding if they removed every country', () => {
    expect(
      nextStep({
        ...base,
        settings: { dailyGoalMinutes: 15, onboardedAt: '2026-10-02T00:00:00Z' },
      }),
    ).toBe('onboarding');
  });
});

describe('primaryCountry', () => {
  it('prefers the primary country, then the first', () => {
    expect(primaryCountry({ ...base, studyCountries: [us, ca] })?.countryCode).toBe('CA');
    expect(primaryCountry({ ...base, studyCountries: [us] })?.countryCode).toBe('US');
    expect(primaryCountry(base)).toBeNull();
  });
});

describe('daysUntilExam', () => {
  it('counts whole days in UTC', () => {
    expect(daysUntilExam(us, new Date('2026-10-02T23:30:00Z'))).toBe(10);
    expect(daysUntilExam(ca)).toBeNull();
  });
});
