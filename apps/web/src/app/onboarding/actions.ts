'use server';

import { OnboardingError, removeStudyCountry, saveOnboarding } from '@oathly/api/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/user';

export interface OnboardingState {
  error: string | null;
}

export async function completeOnboarding(
  _previous: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const user = await currentUser();
  if (!user) redirect('/sign-in');

  const examDate = String(form.get('examDate') ?? '').trim();
  try {
    await saveOnboarding(getDb(), user.userId, {
      countryCode: String(form.get('countryCode') ?? ''),
      examDate: examDate || null,
      studyLocale: String(form.get('studyLocale') ?? ''),
      dailyGoalMinutes: Number(form.get('dailyGoalMinutes')),
      makePrimary: form.get('makePrimary') === 'on',
    });
  } catch (error) {
    if (error instanceof OnboardingError) return { error: error.message };
    throw error;
  }
  revalidatePath('/study');
  redirect('/study');
}

export async function stopStudying(countryCode: string) {
  const user = await currentUser();
  if (!user) redirect('/sign-in');
  await removeStudyCountry(getDb(), user.userId, countryCode);
  revalidatePath('/study');
  redirect('/study');
}
