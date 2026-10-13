# Buying and cancelling a plan: what was tested

12 October 2026.

**Test mode: done, and it works end to end.** A real purchase through Stripe Checkout in the
Stripe sandbox, a cancellation, the end of the subscription, and a Country Pass with a refund.

**Live mode: not done.** It needs things only the account owner has: live Stripe keys on the
host, live prices, a live webhook endpoint, and a real card. The live site cannot sell anything
yet: its webhook answers "Billing is not set up" (read on 12 October). The steps are at the end.

## What changed in the code

| What                                                                                                                                                                                       | Where                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| The landing page's Pro and Country Pass cards have buy buttons. A visitor signs in or signs up first; the plan they picked is carried through sign-in and onboarding to the plans page.    | `components/landing/sections.tsx`, `sign-in-form.tsx`, `welcome`, `onboarding` |
| The plans page (`/study/plans`) is the billing page: the plan held, when it renews or ends, "Cancel plan" (two presses), "Keep my plan" to take a cancellation back, and "Manage billing". | `study/plans/page.tsx`, `study/plans/actions.ts`, `lib/billing.ts`             |
| Cancelling finds the subscription by the signed-in learner's id, so nobody can name someone else's. It stops the renewal; nothing is refunded and Pro runs to the date paid for.           | `stripeProSubscriptionFor` in `packages/api/src/server/billing.ts`             |
| "Manage billing" no longer fails the page when Stripe's portal is not set up; it says the change did not go through.                                                                       | `study/plans/actions.ts`                                                       |
| One command makes the products, the three prices and the portal settings in a Stripe account, and prints the price ids.                                                                    | `apps/web/scripts/billing/setup-stripe.mjs`                                    |

Prices were already read from Stripe (`planPrices` in `lib/billing.ts`, remembered for ten
minutes). Nothing in the code or the translations holds an amount, so the page cannot disagree
with what Stripe charges.

## Test mode: what was done and what happened

Run against a local server and a local database, with the Stripe sandbox that `.env.local`
points at. The sandbox prices are placeholders made for this test: Pro USD 7.99 a month and
USD 59.99 a year, Country Pass USD 19.99. **Choose the real amounts before going live.**

Stripe cannot call a laptop, so each event Stripe recorded for the purchase was fetched from
Stripe and posted to the local webhook, signed with the local signing secret. That is what
`stripe listen` does. The events and their contents are Stripe's own.

| #   | Step                                                                               | Result                                                                                                             |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Landing page, signed out                                                           | Shows "$7.99 a month, $59.99 a year" and "$19.99, once", read from Stripe                                          |
| 2   | New learner presses "Get Pro, monthly" on the landing page                         | Taken through sign-in to `/study/plans?plan=pro_monthly#pro`                                                       |
| 3   | Presses "Get Pro, monthly: $7.99 a month", pays in Stripe Checkout with card 4242… | Checkout shows "Oathly Pro, $7.99 per month"; returns to the plans page                                            |
| 4   | Before any webhook                                                                 | Still Free, 20 questions in the country's pack. Paying alone grants nothing                                        |
| 5   | Stripe's 12 events delivered                                                       | `customer.subscription.created` applied, the other 11 ignored. Plan: Pro, "renews on" the right date, 30 questions |
| 6   | An event with no signature                                                         | 400, nothing changed                                                                                               |
| 7   | Signed with the wrong secret                                                       | 400, nothing changed                                                                                               |
| 8   | A correct signature an hour old (a replay)                                         | 400, nothing changed                                                                                               |
| 9   | Body changed after signing (another learner's id put in)                           | 400, nothing changed                                                                                               |
| 10  | The same event delivered twice, correctly signed                                   | 200 "ignored" the second time; the table is unchanged                                                              |
| 11  | "Cancel plan", then "Yes, cancel my plan"                                          | Stripe: `cancel_at_period_end: true`. Page: "It ends on … and will not renew". Still Pro, still 30 questions       |
| 12  | "Keep my plan"                                                                     | Stripe: renewing again. Page: "It renews on …"                                                                     |
| 13  | Cancelled again, then the subscription ended in Stripe (what the period end does)  | `customer.subscription.deleted` applied. Plan: Free, 20 questions. Access is revoked                               |
| 14  | "Get the pass for Testland", paid USD 19.99                                        | `checkout.session.completed` applied. "Country Pass: Testland", 30 questions                                       |
| 15  | The payment refunded in Stripe                                                     | `charge.refunded` applied. The pass is gone, 20 questions                                                          |
| 16  | Stripe's billing portal for the test customer                                      | Opens                                                                                                              |

Screenshots: `docs/proof/billing-1-landing-prices.png` to `billing-4-cancel-confirm.png`.

Automated, so they run on every change:

- `packages/api/src/server/billing.db.test.ts`: a purchase grants, a cancellation keeps access to
  the period end and then removes it, a refund removes a pass, a repeated event changes nothing,
  an out-of-order event changes nothing, a failed first try is handled again, and only the
  learner's own subscription can be cancelled.
- `packages/api/src/server/billing.test.ts` and `apps/web/e2e/tests/security.spec.ts`: signatures.
- `apps/web/e2e/tests/learner.spec.ts`: the landing buy buttons lead to the plans page, through
  sign-up and onboarding for someone new.

The cancel button itself is not in the automated tests: it calls Stripe, and CI has no Stripe
account. Rows 11 to 13 above are its test.

### Things to know

- **The sandbox is shared.** It already had a product called "Basic Plan" and a webhook endpoint
  pointing at `https://c5k.com/`, from another project. The test's events were sent there too by
  Stripe. Two products were added to it: "Oathly Pro" and "Oathly Country Pass". For Oathly, a
  Stripe account of its own would keep the two apart.
- **`STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PREMIUM` and `STRIPE_PRICE_INSTITUTIONAL`** in
  `.env.local` are from the other project and hold product ids, not price ids. Oathly does not
  read them. The three it does read were added to `.env.local` for local use.
- The date on the plans page is written in the server's time zone. On the host that is UTC, so
  near midnight it can differ by a day from the date Stripe's own emails show.

## Live mode: what you need to do

1. In Stripe, switch to live mode (ideally in an account that is Oathly's own) and copy the live
   secret key.
2. Make the live products and prices with the amounts you have decided on:
   `STRIPE_SECRET_KEY=sk_live_… node apps/web/scripts/billing/setup-stripe.mjs --live --monthly … --yearly … --pass …`
3. In Stripe, add a webhook endpoint `https://oathly.vercel.app/api/billing/stripe/webhook` for
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted` and `charge.refunded`. Copy its signing secret.
4. On Vercel, set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`,
   `STRIPE_PRICE_PRO_YEARLY` and `STRIPE_PRICE_COUNTRY_PASS`, and redeploy.
5. Check: the landing page shows your prices, and
   `curl -X POST https://oathly.vercel.app/api/billing/stripe/webhook` answers 400 ("Signature
   did not verify"), not 503.
6. Sign in on the live site, buy Pro monthly with your own card, and confirm the plans page
   says Pro. Press "Cancel plan" and confirm it says when it ends.
7. In the Stripe dashboard, refund the payment and cancel the subscription immediately. Confirm
   the plans page says Free.

A learner needs a country with published questions before they can finish signing up, so step 6
also waits on the first country being reviewed.
