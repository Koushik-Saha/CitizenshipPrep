// Creates what Oathly sells in a Stripe account: the Pro product with a
// monthly and a yearly price, the Country Pass with a one-time price, and a
// customer portal that lets a subscriber change their card or cancel at the
// end of the period. Prints the three price ids to put in the environment.
//
//   node scripts/billing/setup-stripe.mjs --monthly 7.99 --yearly 59.99 --pass 19.99
//   node scripts/billing/setup-stripe.mjs --monthly 7.99 --yearly 59.99 --pass 19.99 --currency eur
//
// It reads STRIPE_SECRET_KEY from the environment or the repository's
// .env.local. With a live key it stops unless --live is given: live prices
// are what people are charged.
//
// Safe to run again. A price is found by its lookup key; when the amount
// asked for differs from the one found, a new price is made and takes over
// the key (Stripe prices cannot be edited), and the old one is archived.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import Stripe from 'stripe';

const rootEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../.env.local',
);
if (!process.env.STRIPE_SECRET_KEY && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const { values } = parseArgs({
  options: {
    monthly: { type: 'string' },
    yearly: { type: 'string' },
    pass: { type: 'string' },
    currency: { type: 'string', default: 'usd' },
    live: { type: 'boolean', default: false },
  },
});

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const key = process.env.STRIPE_SECRET_KEY ?? '';
if (!key) fail('STRIPE_SECRET_KEY is not set.');
const isLive = !key.startsWith('sk_test_') && !key.startsWith('rk_test_');
if (isLive && !values.live) {
  fail('This is a live key. Run again with --live if you mean to create live prices.');
}

/** "7.99" as 799: Stripe counts in the currency's smallest unit. */
function amount(name) {
  const text = values[name];
  if (!text || !/^\d+(\.\d{1,2})?$/.test(text)) {
    fail(`Give --${name} as an amount, for example --${name} 7.99`);
  }
  const zeroDecimal = ['jpy', 'krw', 'vnd', 'clp'].includes(values.currency.toLowerCase());
  return zeroDecimal ? Math.round(Number(text)) : Math.round(Number(text) * 100);
}

const wanted = [
  {
    plan: 'pro_monthly',
    env: 'STRIPE_PRICE_PRO_MONTHLY',
    product: 'pro',
    amount: amount('monthly'),
    interval: 'month',
  },
  {
    plan: 'pro_yearly',
    env: 'STRIPE_PRICE_PRO_YEARLY',
    product: 'pro',
    amount: amount('yearly'),
    interval: 'year',
  },
  {
    plan: 'country_pass',
    env: 'STRIPE_PRICE_COUNTRY_PASS',
    product: 'pass',
    amount: amount('pass'),
    interval: null,
  },
];
const products = {
  pro: {
    name: 'Oathly Pro',
    description: 'Every question in every country, full-length mock exams and more AI help.',
  },
  pass: {
    name: 'Oathly Country Pass',
    description: 'Every question for one country. One payment, no subscription.',
  },
};

const stripe = new Stripe(key);
const currency = values.currency.toLowerCase();

async function productFor(kind) {
  const found = await stripe.products.search({ query: `metadata['oathly']:'${kind}'` });
  const active = found.data.find((product) => product.active);
  if (active) return active.id;
  const created = await stripe.products.create({ ...products[kind], metadata: { oathly: kind } });
  return created.id;
}

const lines = [];
for (const want of wanted) {
  const lookupKey = `oathly_${want.plan}`;
  const existing = (await stripe.prices.list({ lookup_keys: [lookupKey], active: true })).data[0];
  const same =
    existing &&
    existing.unit_amount === want.amount &&
    existing.currency === currency &&
    (existing.recurring?.interval ?? null) === want.interval;
  let id = existing?.id;
  if (!same) {
    const created = await stripe.prices.create({
      product: await productFor(want.product),
      unit_amount: want.amount,
      currency,
      ...(want.interval ? { recurring: { interval: want.interval } } : {}),
      lookup_key: lookupKey,
      // Takes the key over from the price it replaces.
      transfer_lookup_key: true,
      metadata: { oathly: want.plan },
    });
    if (existing) await stripe.prices.update(existing.id, { active: false });
    id = created.id;
  }
  lines.push(`${want.env}="${id}"`);
}

// The portal behind "Manage billing". Without a configuration Stripe refuses
// to open it.
const portals = await stripe.billingPortal.configurations.list({ limit: 100 });
if (!portals.data.some((portal) => portal.is_default && portal.active)) {
  await stripe.billingPortal.configurations.create({
    business_profile: { headline: 'Oathly' },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
    },
  });
  console.log('Created the customer portal settings.');
}

console.log(`\n${isLive ? 'LIVE' : 'Test'} mode. Put these in the environment:\n`);
console.log(lines.join('\n'));
console.log(
  '\nThen add a webhook endpoint for /api/billing/stripe/webhook (see README.md here) and put',
);
console.log('its signing secret in STRIPE_WEBHOOK_SECRET.');
