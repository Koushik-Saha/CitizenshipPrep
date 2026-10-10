import {
  applyRevenueCatEvent,
  isRevenueCatAuthorized,
  type RevenueCatEvent,
} from '@oathly/api/server';
import { isSwitchedOn } from '@oathly/core';
import { revalidatePath } from 'next/cache';

import { track } from '@/lib/analytics';
import { getDb } from '@/lib/db';

// POST /api/billing/revenuecat/webhook: RevenueCat tells us what happened to
// an App Store or Google Play purchase made in the mobile app, and it is
// written to the same subscriptions table as web purchases.
//
// In RevenueCat's dashboard, set this URL as the webhook and
// REVENUECAT_WEBHOOK_SECRET as its Authorization header value.
export async function POST(request: Request) {
  if (
    !isRevenueCatAuthorized(
      request.headers.get('authorization'),
      process.env.REVENUECAT_WEBHOOK_SECRET,
    )
  ) {
    return Response.json({ error: 'Not authorized.' }, { status: 401 });
  }
  let event: RevenueCatEvent | undefined;
  try {
    event = ((await request.json()) as { event?: RevenueCatEvent }).event;
  } catch {
    // Falls through to the check below.
  }
  if (!event || typeof event.id !== 'string' || typeof event.type !== 'string') {
    return Response.json({ error: 'Not a RevenueCat event.' }, { status: 400 });
  }

  // A failure here answers 500, and RevenueCat delivers the event again later.
  // A purchase made with a store test account costs nothing, so it gives
  // nothing, unless test purchases are let in: for everyone
  // (REVENUECAT_ALLOW_SANDBOX=1, for a test server) or for named accounts
  // (REVENUECAT_SANDBOX_USERS, comma separated ids: the store reviewer's).
  const everyone = isSwitchedOn(process.env.REVENUECAT_ALLOW_SANDBOX);
  const named = (process.env.REVENUECAT_SANDBOX_USERS ?? '').split(',').map((id) => id.trim());
  const outcome = await applyRevenueCatEvent(getDb(), event, {
    allowSandbox: (userId) => everyone || named.includes(userId),
  });
  if (outcome.kind === 'applied') {
    revalidatePath('/[locale]/study', 'layout');
    // A purchase starting, as opposed to renewing or changing, is an upgrade.
    if (outcome.purchase && outcome.userId) {
      track(outcome.userId, 'upgrade', {
        plan: outcome.purchase.plan,
        provider: outcome.purchase.provider,
        country: outcome.purchase.countryCode,
      });
    }
  }
  return Response.json({ received: true, outcome: outcome.kind });
}
