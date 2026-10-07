// Sends the webhook events a payment provider would send, to a local server,
// so plans can be tried end to end without a Stripe account or a store
// purchase: the event is signed (Stripe) or authorised (RevenueCat) exactly
// as the real one is, and goes through the same routes.
//
//   node scripts/billing/simulate.mjs <command> --user <user id> [options]
//
//   stripe-subscribe   a Pro subscription bought on the web     [--plan pro_monthly|pro_yearly]
//   stripe-cancel      ...cancelled in the portal: runs to the end of its period
//   stripe-end         ...the period is over: Stripe ends it
//   stripe-pass        a Country Pass bought on the web          --country US
//   stripe-refund      ...refunded in full
//   store-purchase     Pro bought in the mobile app              [--plan ...] [--store app_store|play_store]
//   store-cancel       ...auto-renew turned off in the store
//   store-expire       ...it ran out
//   store-pass         a Country Pass bought in the mobile app   --country US
//
// Options: --base http://localhost:3000   --days 30 (length of the paid period)
//
// Needs the same secrets the server was started with: STRIPE_WEBHOOK_SECRET
// and STRIPE_PRICE_PRO_MONTHLY / _YEARLY for the stripe-* commands,
// REVENUECAT_WEBHOOK_SECRET for the store-* ones. Never point it at production.

import { parseArgs } from 'node:util';

import Stripe from 'stripe';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    user: { type: 'string' },
    plan: { type: 'string', default: 'pro_monthly' },
    country: { type: 'string' },
    store: { type: 'string', default: 'app_store' },
    base: { type: 'string', default: 'http://localhost:3000' },
    days: { type: 'string', default: '30' },
  },
});
const command = positionals[0];
const user = values.user;
if (!command || !user) {
  console.error('Usage: node scripts/billing/simulate.mjs <command> --user <user id> [options]');
  process.exit(1);
}

const DAY = 86_400_000;
const now = Date.now();
const periodEnd = now + Number(values.days) * DAY;
const unix = (ms) => Math.floor(ms / 1000);
// The same ids each time for one learner, so cancel and end find the purchase.
const slug = user.replace(/[^a-z0-9]/gi, '');
const need = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set.`);
    process.exit(1);
  }
  return value;
};

async function post(path, body, headers) {
  const response = await fetch(values.base + path, { method: 'POST', body, headers });
  console.log(`${command}: ${response.status} ${await response.text()}`);
  if (!response.ok) process.exit(1);
}

async function stripe(type, object) {
  const payload = JSON.stringify({
    id: `evt_sim_${slug}_${now}`,
    object: 'event',
    type,
    created: unix(now),
    data: { object },
  });
  const signature = new Stripe('sk_test_simulate').webhooks.generateTestHeaderString({
    payload,
    secret: need('STRIPE_WEBHOOK_SECRET'),
  });
  await post('/api/billing/stripe/webhook', payload, {
    'content-type': 'application/json',
    'stripe-signature': signature,
  });
}

const subscription = (overrides = {}) => ({
  id: `sub_sim_${slug}`,
  object: 'subscription',
  status: 'active',
  customer: `cus_sim${slug}`,
  metadata: { user_id: user, plan: values.plan },
  cancel_at_period_end: false,
  current_period_start: unix(now - DAY),
  current_period_end: unix(periodEnd),
  items: {
    data: [
      {
        price: {
          id: need(
            values.plan === 'pro_yearly' ? 'STRIPE_PRICE_PRO_YEARLY' : 'STRIPE_PRICE_PRO_MONTHLY',
          ),
        },
      },
    ],
  },
  ...overrides,
});

async function store(event) {
  await post(
    '/api/billing/revenuecat/webhook',
    JSON.stringify({
      api_version: '1.0',
      event: {
        id: `rc_sim_${slug}_${now}`,
        app_user_id: user,
        store: values.store === 'play_store' ? 'PLAY_STORE' : 'APP_STORE',
        environment: 'SANDBOX',
        period_type: 'NORMAL',
        product_id: `oathly_${values.plan}`,
        original_transaction_id: `tx_sim_${slug}`,
        purchased_at_ms: now - DAY,
        expiration_at_ms: periodEnd,
        event_timestamp_ms: now,
        ...event,
      },
    }),
    { 'content-type': 'application/json', authorization: need('REVENUECAT_WEBHOOK_SECRET') },
  );
}

const country = () => {
  if (!/^[A-Za-z]{2}$/.test(values.country ?? '')) {
    console.error('Give --country as a two-letter code.');
    process.exit(1);
  }
  return values.country.toUpperCase();
};

switch (command) {
  case 'stripe-subscribe':
    await stripe('customer.subscription.created', subscription());
    break;
  case 'stripe-cancel':
    await stripe('customer.subscription.updated', subscription({ cancel_at_period_end: true }));
    break;
  case 'stripe-end':
    await stripe(
      'customer.subscription.deleted',
      subscription({
        status: 'canceled',
        cancel_at_period_end: true,
        current_period_end: unix(now),
        ended_at: unix(now),
      }),
    );
    break;
  case 'stripe-pass':
    await stripe('checkout.session.completed', {
      id: `cs_sim_${slug}_${country()}`,
      object: 'checkout.session',
      mode: 'payment',
      client_reference_id: user,
      customer: `cus_sim${slug}`,
      payment_status: 'paid',
      payment_intent: `pi_sim_${slug}_${country()}`,
      metadata: { user_id: user, plan: 'country_pass', country_code: country() },
    });
    break;
  case 'stripe-refund':
    await stripe('charge.refunded', {
      id: `ch_sim_${slug}`,
      object: 'charge',
      refunded: true,
      payment_intent: `pi_sim_${slug}_${country()}`,
    });
    break;
  case 'store-purchase':
    await store({ type: 'INITIAL_PURCHASE' });
    break;
  case 'store-cancel':
    await store({ type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' });
    break;
  case 'store-expire':
    await store({ type: 'EXPIRATION', expiration_at_ms: now });
    break;
  case 'store-pass':
    await store({
      type: 'NON_RENEWING_PURCHASE',
      product_id: `oathly_country_pass_${country().toLowerCase()}`,
      original_transaction_id: `tx_sim_${slug}_${country()}`,
      expiration_at_ms: null,
    });
    break;
  default:
    console.error(`Unknown command "${command}".`);
    process.exit(1);
}
