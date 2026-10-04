import { isStudyLocale } from '@oathly/i18n';
import { z } from 'zod';

import { dailyGoalOptions, isoDate } from './onboarding-options';

export { dailyGoalOptions, isoDate };

function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && isoDate(parsed) === value;
}

/** Exam dates more than this far ahead are almost certainly typos. */
const MAX_YEARS_AHEAD = 5;

export function createOnboardingSchema(today: Date = new Date()) {
  const earliest = isoDate(new Date(today.getTime() - 24 * 60 * 60 * 1000));
  const latest = isoDate(
    new Date(
      Date.UTC(today.getUTCFullYear() + MAX_YEARS_AHEAD, today.getUTCMonth(), today.getUTCDate()),
    ),
  );
  return z.object({
    countryCode: z.string().regex(/^[A-Z]{2}$/, 'Choose a country.'),
    examDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date as year, month and day.')
      .refine(isRealDate, 'That date does not exist.')
      .refine((value) => value >= earliest, 'The exam date has already passed.')
      .refine((value) => value <= latest, `Choose a date within ${MAX_YEARS_AHEAD} years.`)
      .nullable(),
    studyLocale: z.string().refine(isStudyLocale, 'Choose a language to study in.'),
    dailyGoalMinutes: z.number().int().min(5).max(240),
    /** Make this the country the app opens on. The first country always is. */
    makePrimary: z.boolean().default(true),
  });
}

export const onboardingSchema = createOnboardingSchema();

export type OnboardingInput = z.input<typeof onboardingSchema>;
export type Onboarding = z.output<typeof onboardingSchema>;
