'use server';

import {
  AccountError,
  deleteAccount,
  getDeletionPlan,
  removeSignInAccount,
} from '@oathly/api/server';
import { redirect } from 'next/navigation';

import { audit, getDb, requireAdmin } from '@/lib/admin';
import { getStripe } from '@/lib/billing';
import { reportError } from '@/lib/monitoring';

const blockers = {
  staff:
    'This account has checked and published questions, and the record of who verified them has to stay. It cannot be deleted.',
  organization:
    'This account owns an organization that has other members or paid seats. Hand the organization over or close it first.',
} as const;

/**
 * Deletes an account because its owner asked for that: their data, any
 * subscription that would go on charging them, and the record they sign in
 * with. It cannot be undone, so the form asks for the word DELETE and for the
 * reason, which is kept in the record of what staff do.
 */
export async function deleteUserOnRequest(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(form.get('id') ?? '');
  const reason = String(form.get('reason') ?? '').trim();
  const page = `/admin/users/${encodeURIComponent(id)}`;
  const back = (problem: string) => redirect(`${page}?problem=${encodeURIComponent(problem)}`);

  if (!id) redirect('/admin/users');
  if (id === admin.id) back('You cannot delete the account you are signed in with.');
  if (String(form.get('confirm') ?? '').trim() !== 'DELETE') {
    back('Type DELETE to confirm.');
  }
  if (reason.length < 5) back('Say why: who asked, and how.');

  const plan = await getDeletionPlan(getDb(), id);
  if (plan.blocker) back(blockers[plan.blocker]);

  // Nobody should go on being charged for an account that is gone.
  if (plan.stripeSubscriptionIds.length > 0) {
    if (!process.env.STRIPE_SECRET_KEY) {
      back(
        'This account has a subscription and Stripe is not set up here, so it cannot be canceled.',
      );
    }
    try {
      for (const subscription of plan.stripeSubscriptionIds) {
        await getStripe().subscriptions.cancel(subscription);
      }
    } catch (error) {
      reportError(error, { where: 'admin-user-delete', step: 'cancel-subscription' });
      back('The subscription could not be canceled, so nothing was deleted. Try again.');
    }
  }

  try {
    await deleteAccount(getDb(), id);
  } catch (error) {
    if (error instanceof AccountError) back(blockers[error.blocker]);
    throw error;
  }
  // The address they signed in with, and their sessions.
  const signIn = await removeSignInAccount(getDb(), id).catch((error: unknown) => {
    reportError(error, { where: 'admin-user-delete', step: 'sign-in-account' });
    return 'unavailable' as const;
  });
  await audit(
    admin,
    'user.delete',
    { type: 'user', id },
    {
      reason: reason.slice(0, 500),
      subscriptionsCancelled: plan.stripeSubscriptionIds.length,
      signInAccount: signIn,
    },
  );
  redirect(`/admin/users?deleted=${signIn === 'unavailable' ? 'data' : 'all'}`);
}
