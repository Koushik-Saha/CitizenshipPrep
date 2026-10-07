import { applyStripeEvent, type StripeEvent } from '@oathly/api/server';
import { revalidatePath } from 'next/cache';

import { getStripe, stripePrices } from '@/lib/billing';
import { getDb } from '@/lib/db';

// POST /api/billing/stripe/webhook: Stripe tells us what happened to a
// purchase (paid, renewed, cancelled, ended, refunded), and it is written to
// the subscriptions table, which is where access is read from.
//
// Set this URL up in the Stripe dashboard (or `stripe listen --forward-to`)
// for: checkout.session.completed, checkout.session.async_payment_succeeded,
// customer.subscription.created, .updated, .deleted, and charge.refunded.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const prices = stripePrices();
  if (!secret || !prices || !process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'Billing is not set up.' }, { status: 503 });
  }

  // The signature covers the exact bytes Stripe sent: read them unparsed.
  const body = await request.text();
  let event: StripeEvent;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      request.headers.get('stripe-signature') ?? '',
      secret,
    ) as unknown as StripeEvent;
  } catch {
    return Response.json({ error: 'Signature did not verify.' }, { status: 400 });
  }

  // A failure here answers 500, and Stripe delivers the event again later.
  const outcome = await applyStripeEvent(getDb(), event, prices);
  if (outcome.kind === 'applied') revalidatePath('/[locale]/study', 'layout');
  return Response.json({ received: true, outcome: outcome.kind });
}
