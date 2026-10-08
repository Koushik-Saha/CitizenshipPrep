# Plans and billing

| Plan         | What it is                               | Unlocks                                    |
| ------------ | ---------------------------------------- | ------------------------------------------ |
| Free         | no payment                               | a fixed sample of each country's questions |
| Pro monthly  | subscription                             | everything, every country, more AI help    |
| Pro yearly   | subscription                             | the same as monthly                        |
| Country Pass | one payment, per country, never runs out | everything for that country                |

What a plan unlocks is decided in one place: `hasAccess(user, feature,
country)` in `packages/core/src/access.ts`. The size of the free sample is
`FREE_QUESTIONS_PER_COUNTRY` in the same file.

## How a purchase becomes access

```
web:    Stripe Checkout ──► Stripe webhook ─────┐
mobile: App Store / Google Play ─► RevenueCat ──┴─► public.subscriptions ─► hasAccess
```

Both providers write the same table, and both apps read a learner's plan from
the server, so access is the same on every device. A cancelled subscription
stays in force until the end of the period paid for, then ends.

## Stripe (web)

1. In the Stripe dashboard, in test mode, create a product "Oathly Pro" with
   two recurring prices (monthly, yearly) and a product "Country Pass" with a
   one-time price. Put the three price ids and the secret key in `.env.local`
   (names in `.env.example`).
2. Turn on the customer portal (Settings → Billing → Customer portal) and
   allow cancelling at the end of the period.
3. Add a webhook endpoint `https://<your site>/api/billing/stripe/webhook`
   for `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted` and `charge.refunded`. Put its signing
   secret in `STRIPE_WEBHOOK_SECRET`. Locally:
   `stripe listen --forward-to localhost:3000/api/billing/stripe/webhook`.

## RevenueCat (mobile)

1. Create the store products. Their identifiers are how the server knows the
   plan: `oathly_pro_monthly`, `oathly_pro_yearly`, and one non-consumable
   per country, `oathly_country_pass_<iso>` (for example
   `oathly_country_pass_us`).
2. Add them to RevenueCat and to an offering.
3. Set the webhook to `https://<your site>/api/billing/revenuecat/webhook`
   with `REVENUECAT_WEBHOOK_SECRET` as its Authorization header.
4. Put RevenueCat's public SDK keys in `apps/mobile/.env.local` (see
   `apps/mobile/README.md`).

The app tells RevenueCat who is buying by their Oathly user id, which is how
a webhook event is matched to a learner. Sandbox purchases are accepted, as
app review and TestFlight need them to be.

## Trying it without any account

`simulate.mjs` sends the events a provider would, signed or authorised the
same way, to a local server:

```sh
# The server and the script need the same made-up secrets, for example:
export STRIPE_SECRET_KEY=sk_test_local STRIPE_WEBHOOK_SECRET=whsec_local_0123456789abcdef \
  STRIPE_PRICE_PRO_MONTHLY=price_m STRIPE_PRICE_PRO_YEARLY=price_y STRIPE_PRICE_COUNTRY_PASS=price_p \
  REVENUECAT_WEBHOOK_SECRET=local_revenuecat_secret_0123456789

node scripts/billing/simulate.mjs stripe-subscribe --user test:learner   # bought on the web
node scripts/billing/simulate.mjs stripe-cancel    --user test:learner   # cancelled: runs to period end
node scripts/billing/simulate.mjs stripe-end       --user test:learner   # period over: back to Free
node scripts/billing/simulate.mjs store-purchase   --user test:learner --plan pro_yearly
node scripts/billing/simulate.mjs stripe-pass      --user test:learner --country us
```

This exercises everything after the payment itself. The payment pages
(Stripe Checkout, the store's purchase sheet) need real test-mode accounts.

## Organizations (seats)

A law firm, school or nonprofit buys seats rather than a plan: one Stripe
subscription per organization, whose quantity is the number of seats. Each
learner who joins takes a seat and studies on Pro for as long as the
organization has one for them (`seatSource` in `packages/core/src/org.ts`,
read by the same `hasAccess`).

1. Create one more recurring price, per seat (monthly or yearly), and put its
   id in `STRIPE_PRICE_ORG_SEAT`. Without it, seats are not sold; staff can
   still grant them by setting `organizations.seat_limit`.
2. In the customer portal settings, allow customers to update quantities, so
   an admin can add or remove seats themselves. Checkout is only for the
   first purchase.
3. The webhook above already carries what is needed: seats are recorded from
   `customer.subscription.created`, `.updated` and `.deleted`.

When an organization has fewer seats than learners (it shrank its
subscription, or let it end), the learners who joined first keep theirs, the
rest are on the Free plan, and the console says how many are over.

Invitations go out by email when `MAILTRAP_TOKEN` and `EMAIL_FROM` are set.
Without them the admin is shown each invitation link, once, to send
themselves.

```sh
# Seats for an organization (its id is in the address of its CSV export):
node scripts/billing/simulate.mjs org-seats        --user test:owner --org <organization id> --seats 10
node scripts/billing/simulate.mjs org-seats-cancel --user test:owner --org <organization id> --seats 10
node scripts/billing/simulate.mjs org-seats-end    --user test:owner --org <organization id> --seats 10
```
