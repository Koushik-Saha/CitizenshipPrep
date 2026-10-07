// zod/mini: these schemas run in the browser and on phones.
import { paidPlans, type Entitlement } from '@oathly/core';
import * as z from 'zod/mini';

import { membershipSchema } from './org';

// The shape of "the signed-in learner", shared by the web app, the mobile
// app and the API between them.

export const studyCountrySchema = z.object({
  countryCode: z.string(),
  countryName: z.string(),
  examDate: z.nullable(z.string()),
  studyLocale: z.nullable(z.string()),
  isPrimary: z.boolean(),
});

export const entitlementSchema = z.object({
  plan: z.enum([...paidPlans, 'team']),
  countryCode: z.nullable(z.string()),
  status: z.enum(['trialing', 'active', 'past_due', 'canceled', 'expired']),
  currentPeriodEnd: z.nullable(z.string()),
  cancelAtPeriodEnd: z.boolean(),
  provider: z.enum(['stripe', 'app_store', 'play_store', 'manual']),
  organizationName: z.optional(z.nullable(z.string())),
}) satisfies z.ZodMiniType<Entitlement>;

export const meSchema = z.object({
  profile: z.object({ id: z.string(), displayName: z.nullable(z.string()) }),
  settings: z.nullable(
    z.object({
      dailyGoalMinutes: z.number(),
      onboardedAt: z.nullable(z.string()),
    }),
  ),
  studyCountries: z.array(studyCountrySchema),
  progress: z.object({
    attempts: z.number(),
    questionsAnswered: z.number(),
    correctAnswers: z.number(),
  }),
  /**
   * What the learner has paid for, on any device. Ask hasAccess (packages/core)
   * what it unlocks rather than reading it directly.
   */
  entitlements: z.array(entitlementSchema),
  /**
   * The organizations the learner studies with, or helps run. Optional on the
   * way in, so a snapshot a phone saved before organizations existed still reads.
   */
  organizations: z._default(z.array(membershipSchema), []),
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
export function daysUntilExam(
  country: Pick<StudyCountry, 'examDate'>,
  today: Date = new Date(),
): number | null {
  if (!country.examDate) return null;
  const exam = Date.parse(`${country.examDate}T00:00:00Z`);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((exam - start) / (24 * 60 * 60 * 1000));
}
