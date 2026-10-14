// Checks that a running site shows, before sign-in, what Stripe charges for
// each plan, and offers each plan for sale.
//
//   node --env-file=../../.env.local scripts/billing/prices-live.mjs [base-url]
//
// Run it with the same STRIPE_SECRET_KEY and STRIPE_PRICE_* the site has: it
// asks Stripe what each price charges and looks for exactly that on the
// landing page's pricing section, next to that plan's buy button. A site
// without Stripe set up shows no prices and no buy buttons, and fails here.

import Stripe from 'stripe';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');

const plans = [
  { env: 'STRIPE_PRICE_PRO_MONTHLY', plan: 'pro_monthly', label: (p) => `${p} a month` },
  { env: 'STRIPE_PRICE_PRO_YEARLY', plan: 'pro_yearly', label: (p) => `${p} a year` },
  { env: 'STRIPE_PRICE_COUNTRY_PASS', plan: 'country_pass', label: (p) => `${p}, once` },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!process.env.STRIPE_SECRET_KEY) fail('STRIPE_SECRET_KEY is not set.');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/** As formatPrice in @oathly/api writes it, in English. */
function format(amount, currency) {
  const formatter = new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amount / 10 ** digits);
}

const response = await fetch(`${base}/`, { headers: { 'accept-language': 'en' } });
if (!response.ok) fail(`${base}/ answered ${response.status}.`);
const html = await response.text();
const start = html.indexOf('id="pricing"');
if (start < 0) fail('The landing page has no pricing section.');
const section = html.slice(start, html.indexOf('</section>', start));
const text = section
  .replace(/<[^>]+>/g, ' ')
  .replaceAll('&#x27;', "'")
  .replaceAll('&amp;', '&')
  .replace(/\s+/g, ' ');

const problems = [];
for (const { env, plan, label } of plans) {
  const id = process.env[env];
  if (!id) {
    problems.push(`${env} is not set here.`);
    continue;
  }
  const price = await stripe.prices.retrieve(id);
  const shown = label(format(price.unit_amount ?? 0, price.currency));
  const mode = price.livemode ? 'live' : 'test';
  if (!text.includes(shown))
    problems.push(`${plan}: Stripe (${mode}) charges "${shown}", the page does not say so.`);
  else console.log(`${plan}: "${shown}" shown, as Stripe (${mode}) charges.`);
  if (!section.includes(`/sign-in?plan=${plan}`)) problems.push(`${plan}: no buy button.`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
console.log(`Every plan is shown at its Stripe price on ${base}.`);
