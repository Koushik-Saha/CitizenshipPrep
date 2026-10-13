'use server';

import { parsePlanChoice, plansPath } from '@oathly/api/billing';
import { OnboardingError, removeStudyCountry, saveOnboarding } from '@oathly/api/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDb } from '@/lib/db';
import { localizedPath } from '@/lib/i18n';
import { currentUser } from '@/lib/user';

export interface OnboardingState {
  error: string | null;
}

export async function completeOnboarding(
  _previous: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const user = await currentUser();
  if (!user) redirect(await localizedPath('/sign-in'));

  const examDate = String(form.get('examDate') ?? '').trim();
  try {
    await saveOnboarding(getDb(), user.userId, {
      countryCode: String(form.get('countryCode') ?? ''),
      examDate: examDate || null,
      studyLocale: String(form.get('studyLocale') ?? ''),
      dailyGoalMinutes: Number(form.get('dailyGoalMinutes')),
      makePrimary: form.get('makePrimary') === 'on',
      acceptedTerms: form.get('acceptedTerms') === 'on',
    });
  } catch (error) {
    if (error instanceof OnboardingError) return { error: error.message };
    throw error;
  }
  revalidatePath('/[locale]/study', 'page');
  // Someone who pressed a buy button before signing up goes on to the plans.
  const plan = parsePlanChoice(form.get('plan'));
  redirect(await localizedPath(plan ? plansPath(plan) : '/study'));
}

export async function stopStudying(countryCode: string) {
  const user = await currentUser();
  if (!user) redirect(await localizedPath('/sign-in'));
  await removeStudyCountry(getDb(), user.userId, countryCode);
  revalidatePath('/[locale]/study', 'page');
  redirect(await localizedPath('/study'));
}
