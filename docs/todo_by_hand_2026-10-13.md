# What only you can do

13 October 2026. The work of 12 and 13 October is in the repository and deployed. These are the
steps that need your accounts, your decisions or your phone. In the order that matters.

## 1. Move to your own admin account (about ten minutes)

The reviewers' area no longer wants a shared password. It still accepts yours, but only until
the first admin has set up an authenticator; after that the shared password is refused for good.

1. On Vercel, add `ADMIN_SECRET` (`openssl rand -hex 32`) and redeploy. Do this first: it is the
   key authenticators are sealed with, and changing it later means resetting each one
   (`pnpm content staff-reset-2fa`).
2. Sign in on the live site (`/sign-in`) with your own email address. This is also the first real
   sign-in on the live site: if it does not work, the live address is not yet a trusted domain in
   Neon Auth (Neon console > Auth). Fix that first; the shared password keeps working meanwhile.
3. On your machine: `pnpm content staff-grant --email you@example.org --role admin`
4. Open `https://oathly.vercel.app/admin`. It shows a setup key: add it to an authenticator app
   (Google Authenticator, 1Password, Authy), then type the six-digit code.
5. On Vercel, delete `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
6. `pnpm content staff-list` shows who is staff. The old shared account is listed as
   `admin:<name>`; it can no longer sign in, and `pnpm content staff-revoke --user admin:<name>`
   takes its role away.

A reviewer who is not an admin: `--role reviewer`. They get the review queue, moderation and
reports, and none of users, payments, organizations, AI use or activity. A lost phone:
`pnpm content staff-reset-2fa --email …`.

## 2. Selling: Stripe in live mode

Test mode works end to end (`docs/billing_check_2026-10-12.md`). The live site cannot sell yet.
The seven steps are at the end of that document: live key, live prices (you choose the amounts;
7.99, 59.99 and 19.99 in the sandbox are placeholders), a live webhook endpoint, five variables on
Vercel, then one purchase with your own card that you cancel and refund.

## 3. A domain, and an address on it

Three things wait on a domain of your own:

- `LEGAL_CONTACT_EMAIL` on Vercel is a personal Gmail address, shown in the privacy policy and
  the terms. Change it to `support@your-domain`.
- `LEGAL_JURISDICTION` is not set, so the terms say "the law of the country where Koushik Saha is
  established". Set it to name the law, for example `England and Wales`.
- The contact form (`/contact`) sends through Mailtrap, which needs `MAILTRAP_TOKEN` and
  `EMAIL_FROM` on a domain verified there. Until both are set the page shows the address instead
  of a form. `SUPPORT_EMAIL` is where its mail goes; left unset it goes to `LEGAL_CONTACT_EMAIL`.

## 4. Credentials

Nothing was found leaked: the git history was scanned and is clean. So nothing has to be rotated
today because of a leak. None can be rotated from this repository either: each is issued by a
service you sign in to, and the live values are on Vercel.

| Credential                                                                                 | Do                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`                                                         | Delete from Vercel and `.env.local` after step 1. They are retired, not rotated                                                                                     |
| `ADMIN_SECRET`                                                                             | New. Generate and set on Vercel (step 1)                                                                                                                            |
| `STRIPE_SECRET_KEY` (test)                                                                 | The sandbox is shared with another project. Give Oathly its own Stripe account, or roll the key if anyone else has had it                                           |
| `NEON_AUTH_COOKIE_SECRET`                                                                  | Rotate when convenient. It signs everyone out; if `ADMIN_SECRET` is not set, staff set their authenticators up again too                                            |
| `DATABASE_URL` (Neon password)                                                             | Rotate if it has ever been pasted anywhere but Vercel and `.env.local`. Neon console > Roles                                                                        |
| `ANTHROPIC_API_KEY`                                                                        | The same. Set a monthly spend limit in the Anthropic console whether or not you rotate it                                                                           |
| `REVALIDATE_SECRET`                                                                        | The same; it must match on Vercel and in `.env.local`                                                                                                               |
| `MAILTRAP_TOKEN`                                                                           | The same                                                                                                                                                            |
| `PAYPAL_*`, `AWS_*`, `BREVO_API_KEY`, `SMTP_*`, `STRIPE_PRICE_BASIC/PREMIUM/INSTITUTIONAL` | Not Oathly's: they are another project's, sitting in this project's `.env.local`, and every local server and script here is handed them. Take them out of this file |

## 5. Content

- Load the two US source documents into production so the review page shows each question's
  passage. A local test found the passage for 228 of 229 questions. Both are US government works
  in the public domain. From the repository root:

  ```sh
  pnpm content ingest --country US --license public-domain \
    --title "128 Civics Questions and Answers (2025 version)" \
    --file "$PWD/data/sources/US/2025-Civics-Test-128-Questions-and-Answers.pdf" \
    --source-url "https://www.uscis.gov/sites/default/files/document/questions-and-answers/2025-Civics-Test-128-Questions-and-Answers.pdf"

  pnpm content ingest --country US --license public-domain \
    --title "One Nation, One People: The USCIS 2025 Civics Test Study Guide" \
    --file "$PWD/data/sources/US/USCIS-2025-Civics-Test-Study-Guide.pdf" \
    --source-url "https://www.uscis.gov/sites/default/files/document/brochures/USCIS-2025-Civics-Test-Study-Guide.pdf"
  ```

- Approving a question puts it live at once. Run the fact-check over the questions while they are
  still in review, then approve.
- The Holidays section of the official US list can reach at most 10 questions; 12 needs two more
  written.

## 6. Smaller things

- The landing page shows no countries until one has a published question. That is what was asked
  for; it is how the live site looks today.
- "For schools and organisations" is still marked "Coming soon" on the landing page although the
  organization pages exist. Seats are not sold until `STRIPE_PRICE_ORG_SEAT` is set.
- Decide about the Neon Data API (findings M1 and M2 in the security audit): switching it off in
  the Neon console closes both.
