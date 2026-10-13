'use server';

import { setAnalyticsOptOut, updateDisplayName } from '@oathly/api/server';
import { parseDisplayName } from '@oathly/core';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { forgetAnalyticsChoice } from '@/lib/analytics';
import { getDb } from '@/lib/db';
import { localizedPath } from '@/lib/i18n';
import { currentUser } from '@/lib/user';

// What a learner changes about their own account. Each acts on the account
// the session names, never on one named in the form.

/** Saves the name a learner goes by, or clears it. */
export async function saveName(form: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect(await localizedPath('/sign-in'));
  const account = await localizedPath('/study/account');
  const parsed = parseDisplayName(form.get('displayName'));
  if (!parsed.ok) redirect(`${account}?name=problem`);
  await updateDisplayName(getDb(), user.userId, parsed.name);
  revalidatePath('/[locale]/study', 'layout');
  redirect(`${account}?name=saved`);
}

/** Records whether a learner wants their use counted in product statistics. */
export async function setAnalyticsChoice(form: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) redirect(await localizedPath('/sign-in'));
  await setAnalyticsOptOut(getDb(), user.userId, form.get('optOut') === '1');
  forgetAnalyticsChoice(user.userId);
  revalidatePath('/[locale]/study/account', 'page');
  redirect(await localizedPath('/study/account'));
}
