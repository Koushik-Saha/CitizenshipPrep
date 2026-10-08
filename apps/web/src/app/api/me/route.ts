import { AccountError, deleteAccount, getDeletionPlan, getMe } from '@oathly/api/server';
import { cookies } from 'next/headers';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getStripe } from '@/lib/billing';
import { getDb } from '@/lib/db';
import { reportError } from '@/lib/monitoring';
import { rateLimited } from '@/lib/rate-limit';
import { TEST_SESSION_COOKIE } from '@/lib/test-sign-in';

export async function GET(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const me = await getMe(getDb(), userId);
  return me ? Response.json(me) : jsonError('Sign in to continue.', 401);
}

const blocked = (reason: string) =>
  Response.json({ error: 'This account cannot be deleted yet.', reason }, { status: 409 });

// DELETE /api/me: deletes the learner's account and everything they made
// here, for good. Used by the website's account page and the phone app.
//
// A subscription bought on the website is cancelled first, so nobody is
// charged for an account that is gone. One bought in a phone's store can only
// be cancelled there, by the learner: the apps say so before asking.
//
// The sign-in account itself lives with the sign-in service; the app removes
// it there once this has answered.
export async function DELETE(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const limited = await rateLimited('accountDeletion', 'user', userId);
  if (limited) return limited;

  const plan = await getDeletionPlan(getDb(), userId);
  if (plan.blocker) return blocked(plan.blocker);

  if (plan.stripeSubscriptionIds.length > 0 && process.env.STRIPE_SECRET_KEY) {
    try {
      for (const id of plan.stripeSubscriptionIds) await getStripe().subscriptions.cancel(id);
    } catch (error) {
      reportError(error, { where: 'account-deletion', step: 'cancel-subscription' });
      return Response.json(
        {
          error: 'We could not cancel your subscription, so nothing was deleted. Try again.',
          reason: 'subscription',
        },
        { status: 502 },
      );
    }
  }

  try {
    await deleteAccount(getDb(), userId);
  } catch (error) {
    if (error instanceof AccountError) return blocked(error.blocker);
    throw error;
  }
  // A development test session is a cookie of ours: it goes with the account.
  (await cookies()).delete(TEST_SESSION_COOKIE);
  return new Response(null, { status: 204 });
}
