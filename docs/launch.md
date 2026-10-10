# Launch guide

Every step that needs you: an account, a payment, a secret, or a decision.
What the repository can do by itself is already done; where a step has a
command, it is given.

The steps are in the order they depend on each other. Work top to bottom.

- [0. Decide first](#0-decide-first)
- [1. Accounts you need](#1-accounts-you-need)
- [2. Database: Neon](#2-database-neon)
- [3. Sign-in: Neon Auth](#3-sign-in-neon-auth)
- [4. Website: Vercel](#4-website-vercel)
- [5. Payments on the web: Stripe](#5-payments-on-the-web-stripe)
- [6. Email, errors, analytics](#6-email-errors-analytics)
- [7. Check the live website](#7-check-the-live-website)
- [8. Phone apps: before the first build](#8-phone-apps-before-the-first-build)
- [9. iOS: TestFlight](#9-ios-testflight)
- [10. Android: Play internal test](#10-android-play-internal-test)
- [11. Store listings](#11-store-listings)
- [12. Before you submit for review](#12-before-you-submit-for-review)
- [Environment variables, all in one place](#environment-variables-all-in-one-place)

## 0. Decide first

These are baked into things that are hard to change later.

| Decision                                   | Where it lives                                                                          | Default in the repo            | Why it matters                                                                                                                                           |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The app's identifier                       | `apps/mobile/app.json`: `ios.bundleIdentifier`, `android.package`                       | `app.oathly.mobile`            | Permanent once an app is created in either store. Change it now if you want another (use a domain you own, reversed).                                    |
| Your domain                                | DNS, `SITE_URL`                                                                         | none                           | Canonical links, the sitemap and the store listings all carry it.                                                                                        |
| Who runs Oathly                            | `LEGAL_OPERATOR`, `LEGAL_CONTACT_EMAIL`, optional `LEGAL_ADDRESS`, `LEGAL_JURISDICTION` | "Oathly", no contact           | The privacy policy and terms name you and give this address. Without the email they give no way to reach you, which is not acceptable for a live policy. |
| Minimum age                                | `/terms`, `/privacy`, store forms                                                       | 16                             | Stated in the terms and the Play "target audience" form.                                                                                                 |
| Have a lawyer read `/privacy` and `/terms` | `apps/web/src/app/[locale]/privacy` and `/terms`                                        | Drafted from what the app does | They are accurate to the code, but they are a draft, not legal advice.                                                                                   |

**Database provider.** The task said "Supabase production project". This
project moved to Neon (database and sign-in) some time ago, and everything
below is for Neon. If you do want Supabase, say so before starting: sign-in
would have to be rebuilt.

## 1. Accounts you need

| For                       | Account                 | Cost to start                                                                                                                                                 |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website hosting           | Vercel                  | Free tier works; Pro for a team or more traffic                                                                                                               |
| Database and sign-in      | Neon                    | Free tier works; a paid plan for longer backups                                                                                                               |
| Domain                    | Any registrar           | The domain                                                                                                                                                    |
| Web payments              | Stripe                  | None until you sell                                                                                                                                           |
| App payments              | RevenueCat              | Free to start                                                                                                                                                 |
| iOS                       | Apple Developer Program | 99 USD a year. Enrolment can take a day or two: start early.                                                                                                  |
| Android                   | Google Play Console     | 25 USD once. A new personal account must run a closed test with 12 testers for 14 days before it can publish to production; internal testing is not affected. |
| Building the apps         | Expo (EAS)              | Free tier: builds queue, which is fine                                                                                                                        |
| Invitation email          | Mailtrap                | Free tier                                                                                                                                                     |
| Errors                    | Sentry                  | Free tier                                                                                                                                                     |
| Analytics                 | PostHog                 | Free tier                                                                                                                                                     |
| AI explanations and tutor | Anthropic               | Pay as you go                                                                                                                                                 |

## 2. Database: Neon

1. In the Neon console, create a project for production (or use the one you
   have). Pick the region closest to your learners; note it for step 4.
2. Copy two connection strings for the owner role:
   - **pooled** (host contains `-pooler`): this is `DATABASE_URL`;
   - **direct**: this is `DATABASE_URL_UNPOOLED`.
3. Put both in `.env.local` on your machine, then apply the schema:

   ```bash
   pnpm db:deploy
   ```

   It applies every migration in `db/migrations`. Run it again after every
   pull that adds one. It is the only command in this repository that writes
   to Neon.

4. **Do not run the seed** (`db/seed.sql`) on production: it is sample
   content for development. Countries reach production through the content
   pipeline (`pnpm content`), which queues questions for review.
5. **Backups.** Neon keeps a history you can restore from to any moment
   ("instant restore"), for as long as the project's _history retention_
   says:
   - Project settings > Storage (the "instant restore" or "history
     retention" setting, whichever the console calls it). Set it to at least
     **7 days**. Do not set it above **30 days**: the privacy policy promises
     that deleted data is gone from backups within 30 days.
   - Mark the production branch as **protected** (Branches > the branch >
     Set as protected) so it cannot be deleted or reset by accident.
   - Try a restore once, before you need one: Branches > Restore, to a time
     ten minutes ago, into a _new_ branch. Check it has your tables, then
     delete that branch.
6. Make yourself a reviewer, so you can publish content at `/admin`. Sign in
   on the live site once (after step 4), find your id, and give it the role:

   ```sql
   select id, display_name, created_at from public.profiles order by created_at desc limit 5;
   insert into public.user_roles (user_id, role) values ('<your id>', 'admin');
   ```

## 3. Sign-in: Neon Auth

1. Neon console > Auth: enable it for the production branch.
2. Copy the **Auth URL**. It is `NEON_AUTH_BASE_URL` on the server and
   `EXPO_PUBLIC_NEON_AUTH_URL` in the phone app (the same value).
3. Under trusted domains, add `https://<your-domain>`. The phone app presents
   the website's origin, so this covers it too.
4. Turn on the sign-in methods the apps use: **email code** (one-time
   password; the website and the phone app both use it), and **Google** if
   you want it (it needs your own Google OAuth client for production). Neon
   Auth has no "email link" method; the apps do not use one.
5. Generate the cookie secret: `openssl rand -base64 36`. This is
   `NEON_AUTH_COOKIE_SECRET`.
6. **Check that deleting an account deletes the sign-in too.** The apps
   delete a learner's data from the database, then ask Neon Auth to delete
   the sign-in account. This could not be tried without a real Neon Auth
   project. After step 7, create a throwaway account, delete it from
   Account > Delete your account, and look in Neon console > Auth > Users. If
   the user is still listed, account deletion is switched off on the Neon
   Auth side: enable it there, or delete such users by hand until it is. The
   learner's study data is gone either way.

## 4. Website: Vercel

1. Vercel > Add New > Project > import the GitHub repository.
2. **Root Directory:** `apps/web`. Framework: Next.js (detected). Leave the
   build and install commands as detected; Vercel installs from the
   repository root because it is a pnpm workspace.
3. Settings > General > Node.js Version: **24.x**.
4. Settings > Functions > Region: the one nearest your Neon region from
   step 2.
5. Settings > Environment Variables: add the ones marked "to go live" in
   [the table below](#environment-variables-all-in-one-place), for the
   Production environment. `DATABASE_URL` is needed at build time as well as
   at run time: the public pages are built from the database.
6. Deploy. The first build should list `/[locale]/[country]/citizenship-test`
   pages if a country is published, and none if not; both are fine.
7. **Domain.** Settings > Domains > add your domain and follow the DNS
   instructions (an `A` record or a `CNAME`, at your registrar). Add `www`
   too and let Vercel redirect it to the bare domain.
8. Set `SITE_URL` to `https://<your-domain>` (no trailing slash) and
   **redeploy**: it is read at build time, and until it is set every
   canonical link and the sitemap point at `localhost`.
9. Connect the repository (Settings > Git) and production deploys happen on
   every push to `main`. To stop every other branch and pull request from
   building a preview, set Settings > Git > Ignored Build Step to the custom
   command `[ "$VERCEL_GIT_COMMIT_REF" != "main" ]`: Vercel skips the build
   when the command succeeds, which it does on any branch that is not `main`.
   A skipped push shows as a cancelled deployment. If you would rather
   release by hand, disconnect the repository instead.
10. Vercel builds through Turborepo, which hides any environment variable
    not named in `turbo.json` (`tasks.build.env`). A new variable the website
    reads has to be added there as well as on Vercel, or the build will not
    see it.
11. To deploy from your machine: `vercel deploy --prod` from the repository
    root. `.vercelignore` keeps the local build folders out of the upload.

## 5. Payments on the web: Stripe

Do this in **test mode** first, end to end, then repeat in live mode.

1. Products > create three: **Pro monthly** (recurring, monthly), **Pro
   yearly** (recurring, yearly), **Country Pass** (one time). And **Seat**
   (recurring) if you want to sell seats to organizations. Copy each price id
   (`price_...`) into the matching `STRIPE_PRICE_...` variable.
2. Developers > API keys: the secret key is `STRIPE_SECRET_KEY`.
3. Developers > Webhooks > Add endpoint:
   `https://<your-domain>/api/billing/stripe/webhook`, for these events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `charge.refunded`. Its signing secret is
   `STRIPE_WEBHOOK_SECRET`.
4. Settings > Billing > Customer portal: switch it on. Allow cancelling, and,
   for organizations, allow customers to update quantities.
5. Redeploy, then buy Pro with a test card (`4242 4242 4242 4242`) and check
   the Plans page says Pro. `apps/web/scripts/billing/README.md` has more.

## 6. Email, errors, analytics

All optional; the app runs without each.

- **Mailtrap** (organization invitations): verify a sending domain (Sending
  Domains), create an API token (`MAILTRAP_TOKEN`), and set `EMAIL_FROM` to an
  address on that domain, e.g. `Oathly <invites@your-domain>`. Without it,
  admins are shown invitation links to send themselves. Do not set
  `MAILTRAP_INBOX_ID` on the host: it sends everything to a test inbox.
- **Sentry:** create a Next.js project and a React Native project. The DSN of
  the first goes in `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`; the second in
  `EXPO_PUBLIC_SENTRY_DSN` (step 8). For readable stack traces on the web,
  also set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
- **PostHog:** create a project; its project API key is `POSTHOG_KEY`. Set
  `POSTHOG_HOST` to `https://eu.i.posthog.com` if the project is in the EU.
- **Anthropic:** `ANTHROPIC_API_KEY`, for AI explanations and the tutor. Set a
  monthly spend limit in the Anthropic console. The app has its own daily
  limit as well, `AI_DAILY_LIMIT` (requests by everyone in 24 hours, default
  5000): past it free accounts are told AI help is paused, past twice it
  everyone is, and you are told through Sentry at 80% and 100%. To switch a
  feature off in a hurry, set `DISABLE_AI`, `DISABLE_AI_TUTOR`,
  `DISABLE_AI_EXPLANATIONS` or `DISABLE_COMMUNITY` to `1` and redeploy.

## 7. Check the live website

Replace the domain and run these. Each line says what it should print.

```bash
D=https://your-domain

curl -s -o /dev/null -w "%{http_code}\n" $D/                         # 200
curl -s $D/robots.txt | tail -1                                      # Sitemap: https://your-domain/sitemap.xml
curl -s $D/sitemap.xml | grep -c "<loc>https://your-domain"          # more than 0, and no "localhost"
curl -sI $D/ | grep -ci "strict-transport-security\|content-security-policy"   # 2
curl -s -o /dev/null -w "%{http_code}\n" "$D/api/test/sign-in?user=x&secret=x"  # 404
curl -s -o /dev/null -w "%{http_code}\n" $D/api/me                   # 401
curl -s $D/privacy | grep -c "your-contact-email"                    # 1 or more
```

Then, in a browser:

- Sign in with your email. You should land on onboarding.
- Open `/privacy` and `/terms`: your name and contact address are there.
- Open `/admin` (if you set `ADMIN_USERNAME` and `ADMIN_PASSWORD`).
- Do step 3.6: delete a throwaway account.

## 8. Phone apps: before the first build

On your machine:

```bash
npm install --global eas-cli
eas login
cd apps/mobile
eas init          # creates the Expo project and writes its id into app.json: commit that change
```

1. **Identifier.** If you changed it in step 0, do it now in `app.json`,
   before `eas init`.
2. **Environment variables for builds.** They are public values, set in EAS
   per environment. For `production` (and again for `preview` if you want
   preview builds to talk to a different server):

   ```bash
   eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_API_URL --value https://your-domain
   eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_NEON_AUTH_URL --value "<the Auth URL from step 3>"
   eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SENTRY_DSN --value "<React Native DSN>"
   eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value "<appl_...>"
   eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value "<goog_...>"
   ```

   Do **not** create `EXPO_PUBLIC_TEST_SESSION` there.

3. **RevenueCat** (in-app purchases). You can build and install without it;
   the plans screen then shows plans with nothing to buy.
   - Create a project with an iOS app and an Android app using your
     identifier. Their public SDK keys are the two variables above.
   - In App Store Connect and Play Console, create the products. The server
     tells which plan a purchase is from the product's identifier, so name
     them like this: two subscriptions, `oathly_pro_monthly` and
     `oathly_pro_yearly`, and one non-consumable per country,
     `oathly_country_pass_<two-letter code>` (for example
     `oathly_country_pass_us`).
   - In RevenueCat, attach them to an offering, and add a webhook to
     `https://<your-domain>/api/billing/revenuecat/webhook` with the
     Authorization header set to the value of `REVENUECAT_WEBHOOK_SECRET`
     (generate it: `openssl rand -hex 32`, and set it in Vercel too).
4. **Icons and splash** are already generated from the Oathly mark
   (`pnpm --filter @oathly/mobile brand:assets` redraws them).

## 9. iOS: TestFlight

Needs the Apple Developer Program membership to be active.

1. App Store Connect > Apps > New App: platform iOS, your bundle identifier,
   name "Oathly: Citizenship Test Prep" (or what is free), primary language
   English.
2. Build and upload. EAS creates the signing certificate and profile for
   you; say yes when it asks, and sign in with your Apple ID:

   ```bash
   cd apps/mobile
   eas build --platform ios --profile production
   eas submit --platform ios --profile production --latest
   ```

   The first `eas submit` asks which App Store Connect app to use and can
   save the answer into `eas.json`.

3. App Store Connect > TestFlight. The build appears after Apple has
   processed it (ten minutes to an hour). Answer the export compliance
   question if asked (the app declares that it uses no non-exempt
   encryption).
4. TestFlight > Internal Testing > create a group, add yourself.
5. On your iPhone: install the **TestFlight** app, accept the email
   invitation, install Oathly.

## 10. Android: Play internal test

1. Play Console > Create app: name, language, "App", "Free".
2. Build:

   ```bash
   cd apps/mobile
   eas build --platform android --profile production
   ```

   Download the `.aab` it produces. Let EAS create and keep the upload key.

3. **The first upload has to be by hand**: Play Console > Testing > Internal
   testing > Create new release > upload the `.aab`. Play will ask you to
   complete some "App content" forms first; the answers are in
   `docs/store/listing.md`.
4. Internal testing > Testers: create an email list with your Google
   account's address. Copy the **opt-in link**, open it on your Android
   phone, accept, and install from the Play Store.
5. For later uploads without the browser: create a service account with
   access to the app (Play Console > Setup > API access), download its JSON
   key as `apps/mobile/play-service-account.json` (the file is ignored by
   git), then:

   ```bash
   eas submit --platform android --profile production --latest
   ```

## 11. Store listings

- Text for every field of both stores, the App Privacy answers and the Data
  safety answers: `docs/store/listing.md`.
- Screenshots for each device size: `apps/mobile/store/screenshots/`, made by
  `pnpm --filter @oathly/mobile store:screenshots` (see
  `apps/mobile/store/README.md`). **Make them again once a real country is
  published**, and look at each before uploading: they are captured from the
  app's browser build, so the status bar and fonts are a browser's, not a
  phone's. Screenshots taken on a real phone are better if you can.

## 12. Before you submit for review

Installing a test build needs none of this. Submitting to the public stores
does.

- [ ] **A sign-in for App Review.** Apple's and Google's reviewers have to
      get into the app, and sign-in is by a code emailed to an address they
      do not have. Nothing in the app solves this yet. The usual ways: give
      them an address whose mail you can forward the code from quickly (weak:
      reviews happen at any hour), or add a password sign-in for one review
      account. Decide, then say how in the review notes.
- [ ] **Test purchases for App Review.** Reviewers buy with store test
      accounts, and the server ignores test purchases unless told otherwise.
      Put the review account's Oathly id in `REVENUECAT_SANDBOX_USERS` on
      Vercel (comma separated for more than one) before you submit. Never
      set `REVENUECAT_ALLOW_SANDBOX` on production: it lets every test
      purchase count.
- [ ] A real country is published, and the screenshots show it.
- [ ] `/privacy` and `/terms` have been read by someone qualified.
- [ ] Step 3.6 passed: deleting an account removes the sign-in account.
- [ ] Live-mode Stripe keys and prices are set, and a real purchase worked.
- [ ] In-app purchases are approved in both stores (they are reviewed with
      the first app version).
- [ ] The Maestro flows have been run on a phone
      (`apps/mobile/README.md`). They have only ever been run against the
      browser build.

## Environment variables, all in one place

`.env.example` explains each; this says where it is set and whether going
live needs it.

**Vercel (Production):**

| Variable                                                                                                                         | To go live                                         | From                                          |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------- |
| `DATABASE_URL`                                                                                                                   | Yes                                                | Neon, pooled connection string (step 2)       |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`                                                                                  | Yes                                                | Step 3                                        |
| `SITE_URL`                                                                                                                       | Yes                                                | `https://<your-domain>`                       |
| `LEGAL_OPERATOR`, `LEGAL_CONTACT_EMAIL`                                                                                          | Yes                                                | Step 0                                        |
| `LEGAL_ADDRESS`, `LEGAL_JURISDICTION`                                                                                            | If they apply to you                               | Step 0                                        |
| `REVALIDATE_SECRET`                                                                                                              | Yes                                                | `openssl rand -hex 32`                        |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`                                                                                               | To review content                                  | You choose; password of 12 characters or more |
| `ANTHROPIC_API_KEY`                                                                                                              | For AI explanations and the tutor                  | Anthropic console                             |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_COUNTRY_PASS` | To sell on the web                                 | Step 5                                        |
| `STRIPE_PRICE_ORG_SEAT`                                                                                                          | To sell seats                                      | Step 5                                        |
| `REVENUECAT_WEBHOOK_SECRET`                                                                                                      | To sell in the apps                                | Step 8                                        |
| `MAILTRAP_TOKEN`, `EMAIL_FROM`                                                                                                   | To email invitations                               | Step 6                                        |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`                                                                                           | No                                                 | Step 6                                        |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`                                                                              | No                                                 | Step 6                                        |
| `POSTHOG_KEY`, `POSTHOG_HOST`                                                                                                    | No                                                 | Step 6                                        |
| `GOOGLE_TTS_API_KEY`                                                                                                             | No (only the content CLI uses it, on your machine) | Google Cloud                                  |

Never set on Vercel: `TEST_SIGN_IN_SECRET`, `TEST_DATABASE_URL`,
`EXPO_WEB_ORIGIN`, `DATABASE_URL_UNPOOLED` (migrations run from your machine).

**Your machine (`.env.local`):** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
`ANTHROPIC_API_KEY`, `REVALIDATE_SECRET` and `SITE_URL` (so the content CLI
can refresh the live pages), `GOOGLE_TTS_API_KEY` if you record audio.

**EAS (per environment):** `EXPO_PUBLIC_API_URL`,
`EXPO_PUBLIC_NEON_AUTH_URL`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`,
`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_SENTRY_DSN`. All public.

**GitHub (Settings > Secrets > Actions):** `DATABASE_URL`, for the monthly
source check (`.github/workflows/source-check.yml`).
