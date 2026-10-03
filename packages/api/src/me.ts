import { z } from 'zod';

// The shape of "the signed-in learner", shared by the web app, the mobile
// app and the API between them.

export const studyCountrySchema = z.object({
  countryCode: z.string(),
  countryName: z.string(),
  examDate: z.string().nullable(),
  studyLocale: z.string().nullable(),
  isPrimary: z.boolean(),
});

export const meSchema = z.object({
  profile: z.object({ id: z.string(), displayName: z.string().nullable() }),
  settings: z
    .object({
      dailyGoalMinutes: z.number(),
      onboardedAt: z.string().nullable(),
    })
    .nullable(),
  studyCountries: z.array(studyCountrySchema),
  progress: z.object({
    attempts: z.number(),
    questionsAnswered: z.number(),
    correctAnswers: z.number(),
  }),
});

export const examCountrySchema = z.object({
  isoCode: z.string(),
  name: z.string(),
  examLanguages: z.array(z.string()),
});

export type StudyCountry = z.infer<typeof studyCountrySchema>;
export type Me = z.infer<typeof meSchema>;
export type ExamCountry = z.infer<typeof examCountrySchema>;

/** Where a signed-in learner should be sent: onboarding until they have chosen a country. */
export function nextStep(me: Me): 'onboarding' | 'study' {
  return me.settings?.onboardedAt && me.studyCountries.length > 0 ? 'study' : 'onboarding';
}

/** The country the app opens on. */
export function primaryCountry(me: Me): StudyCountry | null {
  return me.studyCountries.find((country) => country.isPrimary) ?? me.studyCountries[0] ?? null;
}

/** Whole days from `today` until the exam, or null when no date is set. */
export function daysUntilExam(country: StudyCountry, today: Date = new Date()): number | null {
  if (!country.examDate) return null;
  const exam = Date.parse(`${country.examDate}T00:00:00Z`);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((exam - start) / (24 * 60 * 60 * 1000));
}
