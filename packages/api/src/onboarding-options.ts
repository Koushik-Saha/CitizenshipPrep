// The onboarding choices, without the validation schema, so the onboarding
// form can use them without shipping zod to the browser.

/** Minutes a day the learner can choose from. */
export const dailyGoalOptions = [5, 10, 15, 20, 30, 45, 60] as const;

/** YYYY-MM-DD for a date, in UTC. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
