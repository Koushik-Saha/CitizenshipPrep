# Security audit

White-box review, 9 October 2026. Part 1 covers the database, the server and payments; part 2
covers the browser, the phone app and the AI features. No code was changed in the review itself;
the "Status" line under each finding was filled in afterwards, as fixes landed.

**How it was done.** The policies, grants and functions were read from a local database with all
19 migrations applied, not only from the migration files. Every route in `apps/web/src/app/api`,
every Server Action and the server functions behind them were read. The full git history, on
every branch, was scanned with gitleaks 8.30.1. `pnpm audit --prod` was run. The live site was
asked for its response headers and nothing else.

**What "Supabase" means here.** The project runs on Neon. The equivalents are: Neon's Data API
for Supabase's REST API (it is switched on in production, and it lets a signed-in phone or
browser query tables directly, with row level security as the only guard); the database owner's
connection string for the `service_role` key; and no storage buckets at all (logos and audio are
rows in tables).

**Severity.** Critical: anyone can take over accounts, read other people's data or run up
unlimited cost today. High: a signed-in attacker can defeat a control the product depends on.
Medium: needs a condition that is not met yet, or the harm is limited. Low: hardening.

## Summary

| Id  | Severity | Finding                                                                       | Status |
| --- | -------- | ----------------------------------------------------------------------------- | ------ |
| H1  | high     | A study-group post can be rewritten after moderation, through the Data API    | fixed  |
| H2  | high     | An AI request that is cut off is never counted, so the daily cap is optional  | fixed  |
| H3  | high     | No overall cap on AI spend                                                    | fixed  |
| M1  | medium   | Anyone can download every published question through the Data API             | open   |
| M2  | medium   | Every signed-in user can list all profiles, and set any display name          | open   |
| M3  | medium   | A payment event is marked handled before it is applied                        | fixed  |
| M4  | medium   | Test (sandbox) purchases unlock Pro in production                             | fixed  |
| M5  | medium   | Organization invitations can be used to send mail to anyone                   | open   |
| M6  | medium   | The rate limiter lets everything through when it cannot reach the database    | fixed  |
| M7  | medium   | Reviewer sign-in is one shared password with a session that cannot be ended   | open   |
| M8  | medium   | Post screening can be talked out of its verdict, and ignores personal data    | fixed  |
| M9  | medium   | The content security policy allows inline scripts and any HTTPS connection    | open   |
| L1  | low      | Three reports from any three accounts hide a post                             | open   |
| L2  | low      | A session's score is taken from the client                                    | open   |
| L3  | low      | The phone keeps its session in the cookie store, not the Keychain or Keystore | open   |
| L4  | low      | No limit on answers, sessions, packs or direct question flags                 | open   |
| L5  | low      | Source text reaches the tutor unreviewed; drafting has no "data" guard        | open   |
| L6  | low      | The tutor accepts a conversation history written by the client                | open   |
| L7  | low      | Invitation tokens travel in the address of the page                           | open   |
| L8  | low      | Four advisories in build tooling                                              | open   |
| L9  | low      | Staff could publish through the Data API with no review record                | open   |
| L10 | low      | An AI explanation was given for questions outside the learner's plan          | fixed  |

No critical finding. No secret was found in the git history, so there is nothing to rotate.

**After the fixes (9 October 2026):** all three high findings are fixed, with four of the nine
medium ones and one low. Open: five medium (M1 and M2, which wait for a decision; M5; M7; and M9,
which `docs/security.md` already records as accepted) and nine low.

## Part 1: database, server, payments

### 1. Row level security

Checked and sound:

- All 33 tables in `public` have row level security on and at least one policy; the local
  database confirms it, and `db/tests/001_structure.test.sql` fails the build if one is added
  without. 262 database tests cover read, insert, update and delete per role.
- The signed-out role can read five tables and write none: `countries`, `exam_formats`, `topics`,
  `questions`, `question_translations`. None holds learner data.
- Learner tables (`attempts`, `answer_events`, `mastery`, `mock_exams`, `user_countries`,
  `user_settings`, `subscriptions`, `ai_usage`) are scoped to `user_id = current_user_id()` for
  every command that is granted. `subscriptions`, `billing_*`, `rate_limits`, `ai_usage` and
  `org_invites` cannot be written by any client.
- Security-definer functions: `private.has_role`, `private.org_role_of` and
  `private.handle_new_organization`. Each pins `search_path = ''`, lives in the `private` schema
  (not exposed by the Data API), and only the first two can be executed by `authenticated`. They
  return a role and take no free text.
- The owner connection string is the only credential that bypasses row level security. CI scans
  the web and phone bundles for it on every build (`scripts/security/client-bundles.mjs`).

#### H1. A study-group post can be rewritten after moderation, through the Data API (high)

- **Where:** `db/migrations/20261002200400_community.sql:162` and `:212` (the `update (title,
body, …)` grants), the policies "Authors can edit their own visible posts/comments" in the same
  file, and `db/migrations/20261011100000_community_groups.sql:54-60` (the hold trigger fires
  `before insert` only).
- **Exploit:** a learner posts something harmless, which is screened and shown. With the token
  the phone app already holds, they send an update for that row straight to the Data API and
  replace the title and body with abuse, advertising or someone's personal details. Nothing
  screens an update, the row stays visible, and it now carries text no moderator saw. The app
  itself has no "edit post" feature, so nothing legitimate uses this path.
- **Fix:** revoke `update` on `community_posts` and `community_comments` from `authenticated`
  (the server writes as the owner and is unaffected). If editing is wanted later, do it on the
  server, through the same screening as a new post.
- **Status:** **fixed** in `ee04157`. A signed-in client can no longer change the title or body of a post or comment (`db/migrations/20261012100000_community_edits_screened.sql`); test `db/tests/015_direct_access.test.sql`. Needs `pnpm db:deploy` to reach production.

#### M1. Anyone can download every published question through the Data API (medium)

- **Where:** `db/migrations/20261002200100_content.sql:278` and `:310` (`grant select … to
anonymous`), with the policy "Anyone can read published questions".
- **Exploit:** with no account, one request to the Data API returns every published question,
  its correct answer and its explanation, for every country. That is the paid product: the free
  plan's sample and the Pro paywall are enforced only in the web server. The Data API address is
  not in any bundle, but it follows the same pattern as the public sign-in address. The rows also
  carry `verified_by` and `created_by` (reviewer account ids).
- **Fix:** revoke `select` on `questions` and `question_translations` from `anonymous` and
  `authenticated`, and keep it for staff only (the public pages are built by the server). Better
  still, switch the Data API off in the Neon console: no client in this repository uses it.
- **Status:** open. Confirmed by hand (`docs/pentest_2026-10-09.md`, P1). Left for your decision: the tests record open reading of published questions as intended, and closing it changes that. The quickest fix is yours: switch the Data API off in the Neon console.

#### M2. Every signed-in user can list all profiles, and set any display name (medium)

- **Where:** `db/migrations/20261002200000_foundation.sql:158` ("Signed-in users can read
  profiles", `using (true)`) and `:156` (insert and update of `display_name`, `avatar_url`).
- **Exploit:** any account can read the id and name of every learner, which is a list of people
  preparing for citizenship. Any account can also set its own display name, unscreened, to
  "Oathly moderator", an insult or an address, and that name is shown beside its posts.
- **Fix:** limit reading to one's own profile (the server already supplies authors' names for
  posts); revoke `update (display_name, avatar_url)` from `authenticated` until a screened
  "change name" exists on the server.
- **Status:** open. Confirmed by hand (I10, C3). Same decision as M1; switching the Data API off closes it.

#### L9. Staff could publish through the Data API with no review record (low)

- **Where:** `db/migrations/20261002200100_content.sql:279` and the policy "Staff can change
  questions".
- **Exploit:** an account with the `editor` or `reviewer` role could set `status = 'published'`
  directly. The trigger stamps who did it, but no row is written to `question_reviews`. No such
  account exists today: reviewers sign in to `/admin` with the shared account, which has no token.
- **Fix:** revoke `insert, update, delete` on the content tables from `authenticated`.
- **Status:** open.

### 2. Ids in requests (IDOR)

Every route that takes an id was traced to its query. Each one scopes by the caller:

| Route or action                                  | Check                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `GET /api/study/sessions/[id]`                   | `where a.id = $1 and a.user_id = $2` (`study.ts:499`)                    |
| `POST /api/attempts/[id]/complete`               | `where id = $1 and user_id = $2` (`study.ts:638`)                        |
| `POST /api/answers`                              | the attempt must be the caller's (`quiz.ts:126`)                         |
| `POST /api/study/sessions/offline`               | an existing attempt id owned by someone else is refused (`study.ts:856`) |
| `GET /api/packs/[country]`                       | the caller's own access decides what is in the pack (`study.ts:766`)     |
| `GET /api/orgs/[id]/report`                      | caller's role in that organization, else 403 or 404 (`org.ts:215`)       |
| organization actions (invite, assign, remove …)  | `getOrgAccess` for the caller, then `canManageMember`                    |
| community actions (comment, vote, report)        | the post must be visible and in a country the caller studies             |
| `POST /api/explain`, `POST /api/tutor`           | the caller's own plan and study countries                                |
| `GET /api/orgs/[id]/logo`, `GET /api/audio/[id]` | public by design: a logo, and a recording of a published question        |

No finding.

#### L2. A session's score is taken from the client (low)

- **Where:** `apps/web/src/app/api/attempts/[id]/complete/route.ts:18-25`,
  `packages/api/src/server/study.ts:618`.
- **Exploit:** a learner can report "50 of 50, passed" for their own mock exam without answering.
  It changes only their own readiness, and what their organization's administrator sees of them.
- **Fix:** work the score out on the server from the recorded answers of that attempt.
- **Status:** open.

### 3. Roles

- `/admin` is guarded three times: the proxy (`apps/web/src/proxy.ts:21-34`), the console layout
  and every Server Action, each through `requireReviewer` (`apps/web/src/lib/admin.ts:17`). A
  learner's session is not a reviewer's: the two sign-ins share nothing. With the admin variables
  unset, `/admin` answers 404.
- Publishing happens in one place, `packages/content/src/review.ts:794`, reachable only through
  those actions.
- Organization roles are checked on the server in every function in
  `packages/api/src/server/org.ts`, and again by row level security.

#### M7. Reviewer sign-in is one shared password with a session that cannot be ended (medium)

- **Where:** `packages/api/src/server/admin-session.ts:45-55`,
  `apps/web/src/app/(internal)/admin/sign-in/actions.ts:33`.
- **Exploit:** the session is a signed expiry time. Signing out deletes the cookie in that browser
  only; a copied cookie keeps working for twelve hours, and only changing the password ends it.
  There is one account for every reviewer, no second factor, and `verified_by` cannot say which
  person approved a question. The signing key is a single SHA-256 of the password, so a stolen
  cookie also allows guessing the password offline.
- **Fix:** per-person reviewer accounts (a role on a normal account, plus a second factor), with
  sessions stored on the server so they can be ended. Until then: a long random password, and
  derive the signing key from a separate secret.
- **Status:** open.

### 4. Sign-in

- Sign-in is by emailed code or Google, handled by Neon Auth. The website proxies it
  (`apps/web/src/app/api/auth/[...path]/route.ts`) and limits requests by address and by
  recipient. There is no password to reset.
- Where a learner lands after signing in is built from a fixed list
  (`apps/web/src/components/auth/sign-in-form.tsx:22-34`): there is no free-form return address
  to abuse. The reviewer sign-in's return path is checked (`adminReturnPath`).
- The test sign-in exists only when `NODE_ENV` is `development`
  (`apps/web/src/lib/test-sign-in.ts:11`).

Not verified, because they are settings of the Neon Auth service and need the live project:
that only your domain is trusted for redirects, how long a session lasts, that signing out ends
the token, and that asking for a code answers the same for known and unknown addresses. The phone
app presents the website's origin in a header it sets itself (`apps/mobile/src/lib/auth.ts:17-19`),
so the trusted-domain list stops browsers on other sites, not scripts.

### 5. Payments

- Stripe: the signature is verified on the raw body before anything is read
  (`apps/web/src/app/api/billing/stripe/webhook/route.ts:26`). RevenueCat: the shared secret is
  compared in constant time (`packages/api/src/server/billing.ts:797`).
- Access comes only from those events. No route grants a plan from what a client says; the
  "purchase succeeded" page only re-reads the database.
- Each event id is stored once (`billing_events`), so a repeated delivery changes nothing.

#### M3. A payment event is marked handled before it is applied (medium)

- **Where:** `packages/api/src/server/billing.ts:272-284` (`firstDelivery`), used at `:533`,
  `:588`, `:604`, `:755` and `:778` before the subscription row is written, outside a transaction.
- **Exploit:** not an attack, a loss. If the write that follows fails (a dropped connection),
  the provider retries, the retry is answered "already handled", and a learner who paid never
  gets their plan.
- **Fix:** record the event and apply it in one transaction, or record it last.
- **Status:** **fixed** in `bf674ba`. An event whose handling fails is forgotten, so the provider's retry counts; test in `billing.db.test.ts`.

#### M4. Test (sandbox) purchases unlock Pro in production (medium)

- **Where:** `packages/api/src/server/billing.ts:742` (`applyRevenueCatEvent` never reads the
  event's `environment`).
- **Exploit:** a purchase made with a store test account costs nothing and RevenueCat reports it
  like any other, marked `SANDBOX`. Anyone with a test account on a build of the app gets Pro on
  the production server.
- **Fix:** ignore events whose `environment` is not `PRODUCTION`, unless a server setting allows
  them.
- **Status:** **fixed** in `bf674ba`. Test purchases are ignored unless let in with `REVENUECAT_ALLOW_SANDBOX` (a test server) or `REVENUECAT_SANDBOX_USERS` (named accounts). **You will need the second for store review:** reviewers buy with test accounts.

### 6. Input

- Every API body and path id is parsed with a Zod schema before use; Server Actions for study and
  community use the same schemas, and the organization and review actions validate by hand in
  tested functions (already noted in `docs/security.md`).
- All SQL is parameterised. The few interpolated fragments are constants or come from a fixed
  two-item choice (`community.ts:312-328`, `org.ts:638`, `review.ts:338`).
- The only upload from a user is an organization logo: 256 KB at most, type taken from its first
  bytes, served with `nosniff` and a sandboxing policy. Source PDFs are read by the content
  command line on your own machine and never uploaded through the site. There are no avatars to
  upload.

No finding.

### 7. Secrets

- gitleaks over all commits on all branches: no leaks. A second search of the full history for
  Neon, Stripe, Anthropic and Google key shapes: none.
- The only env files ever committed are the two `.env.example` files, with empty values.
  `.env*` and `play-service-account.json` are ignored.
- Nothing needs rotating on the evidence of the repository.

### 8. Rate limiting

In place, counted in Postgres: sign-in by address and by recipient, AI explanations, tutor
messages, exam results, account deletion, reviewer sign-in, and study-group posts, comments,
upvotes and reports (`packages/core/src/rate-limit.ts`).

#### M6. The rate limiter lets everything through when it cannot reach the database (medium)

- **Where:** `apps/web/src/lib/rate-limit.ts:44-49`.
- **Exploit:** when the counter query fails, the request is allowed. Under load, or during a
  database incident, every limit disappears at once, including the ones in front of the AI.
- **Fix:** keep failing open for sign-in (so an incident does not lock everyone out), but refuse
  AI and posting requests when the limiter cannot count.
- **Status:** **fixed** for AI requests and study-group writing in `a9ecfc1` and `9a8715b`: they are refused when the limiter cannot count. Sign-in still lets requests through, on purpose.

#### M5. Organization invitations can be used to send mail to anyone (medium)

- **Where:** `apps/web/src/app/[locale]/org/actions.ts:203` and `:262` (no rate limit),
  `packages/api/src/server/org.ts:351-430` (an invitation as `admin` takes no seat).
- **Exploit:** any account can create an organization for free, give it any name, and invite any
  number of addresses as administrators. Each receives an email from your sending domain carrying
  the attacker's chosen organization name. It needs email to be configured, which it is not yet.
- **Fix:** rate limit invitations per account and per organization, cap administrator invitations,
  and hold invitations from organizations with no paid or granted seats.
- **Status:** open.

#### L4. No limit on answers, sessions, packs or direct question flags (low)

- **Where:** `apps/web/src/app/api/answers/route.ts`, `api/study/sessions/route.ts`,
  `api/packs/[country]/route.ts`; `content_flags` insert through the Data API.
- **Exploit:** a signed-in script can add rows without end, 100 answers a request.
- **Fix:** a generous per-account limit on each.
- **Status:** open.

#### L1. Three reports from any three accounts hide a post (low)

- **Where:** `packages/core/src/community.ts:29`.
- **Exploit:** three free accounts can hide any post until a moderator looks.
- **Fix:** weigh reports by account age, or require the reporters to have studied.
- **Status:** open.

### 9. Logging

- The server logs errors only (`apps/web/src/lib/monitoring.ts:13`); no route logs a body, a
  token, an email address or an answer.
- Sentry has user details, cookies, headers, bodies and query strings switched off on the web
  (`apps/web/src/lib/sentry-options.ts`) and `sendDefaultPii: false` with no screenshots on the
  phone. PostHog receives an account id and counts.

#### L7. Invitation tokens travel in the address of the page (low)

- **Where:** `apps/web/src/app/[locale]/join/[token]/page.tsx`.
- **Exploit:** the token is part of the path, so it appears in the host's request log and in an
  error report's page address. Whoever reads those could join the organization as that invitee.
- **Fix:** strip `/join/…` addresses in Sentry's `beforeSend`; tokens already expire.
- **Status:** open.

### 10. Dependencies

`pnpm audit --prod`: 2 high, 2 moderate, the same four as in `docs/security.md`.

| Package                | Severity | Reached through                         | Fixed in | Runs for a learner?                     |
| ---------------------- | -------- | --------------------------------------- | -------- | --------------------------------------- |
| `node-forge`           | high     | `expo` > `@expo/cli`                    | none yet | No: build tooling                       |
| `braces`               | high     | `react-native` > `metro`                | none yet | No: build tooling                       |
| `uuid`                 | moderate | `expo` > `@expo/config-plugins` > xcode | 11.1.1   | No: build tooling                       |
| `decode-uri-component` | moderate | `expo-router` > `query-string`          | 0.5.0    | Yes, in the phone app, on its own links |

#### L8. Four advisories in build tooling (low)

- **Fix:** add a pnpm override for `decode-uri-component` to 0.5.0 or later and `uuid` to 11.1.1
  or later; take the other two with the next Expo SDK. No package in use is abandoned.
- **Status:** open.

## Part 2: browser, phone app, AI

### 1. Headers

Read from `apps/web/next.config.ts` and from a live request to `https://oathly.vercel.app/`:
HSTS for two years with subdomains and preload; `X-Frame-Options: DENY` and
`frame-ancestors 'none'`; `X-Content-Type-Options: nosniff`;
`Referrer-Policy: strict-origin-when-cross-origin`; a `Permissions-Policy` that allows the
microphone to this site only; no `X-Powered-By`.

#### M9. The content security policy allows inline scripts and any HTTPS connection (medium)

- **Where:** `apps/web/next.config.ts:25` (`script-src 'self' 'unsafe-inline'`) and `:32`
  (`connect-src 'self' https:`).
- **Exploit:** none today, because no page renders user or model text as HTML. But the policy
  would not stop an injected script if one ever got in, and would let it send data to any site.
- **Fix:** name the hosts in `connect-src` (the sign-in service and Sentry). Removing
  `'unsafe-inline'` needs a nonce per request, which means the public pages can no longer be
  built ahead of time; `docs/security.md` records that as accepted.
- **Status:** open.

### 2. XSS

- One `dangerouslySetInnerHTML` in the codebase, for search-engine data
  (`apps/web/src/components/seo/test-page.tsx:19`), fed by `jsonLdScript`, which escapes `<`, `>`
  and `&` (`packages/core/src/seo.ts:52`). Its input is reviewed content, not user text.
- Posts, comments, display names, tutor replies and AI explanations are rendered as React text.
  Nothing renders Markdown.
- Links built from data (`sourceUrl`) come from reviewed content. The CSV report makes cells that
  start with `=`, `+`, `-` or `@` plain text (`packages/core/src/org.ts:468`).

No finding.

### 3. CSRF and CORS

- API routes treat a cookie request from another site as signed out
  (`apps/web/src/lib/api-auth.ts:41`), and session cookies are `SameSite=Lax`. Server Actions
  carry the framework's own origin check.
- CORS headers are set only for a development origin (`next.config.ts:86`). On the live site,
  `Access-Control-Allow-Origin: *` appears only on cached public data, never with credentials;
  `/api/me` and a preflight to `/api/answers` send none.

No finding.

### 4. Phone app

#### L3. The phone keeps its session in the cookie store, not the Keychain or Keystore (low)

- **Where:** `apps/mobile/src/lib/auth.ts:7-9` (the session cookie lives in the platform's cookie
  store), `apps/mobile/src/lib/session.tsx:31` (the learner's profile and plan are cached in
  AsyncStorage).
- **Exploit:** on a rooted or jailbroken phone, or from an unencrypted device backup, the session
  cookie and the cached profile can be read. The token itself is not written to AsyncStorage.
- **Fix:** keep the session in `expo-secure-store`. Check on a real device what is included in
  backups.
- **Status:** open.

Also checked: no secret in `app.json` or the bundles (CI scans both); the test session is compiled
out of release builds (`apps/mobile/src/lib/env.ts:17`); the only link the app opens comes from
the store's own subscription page; the session screen takes an id from the address and the server
checks its owner. There are no over-the-air updates, so there is nothing to sign. None of this has
been confirmed on a device.

### 5. Prompt injection

- The tutor's instructions hold no secret, and its context holds only study material and
  published questions for a country the learner studies: there is no other learner's data, key or
  tool for an injection to reach. Model output is shown as text and never run or put in a query;
  the search words taken from the learner's question are stripped to letters and digits before
  they reach `to_tsquery` (`packages/api/src/server/ai/tutor.ts:28-43`).
- Both prompts say the material is reference text, not instructions.

#### L6. The tutor accepts a conversation history written by the client (low)

- **Where:** `packages/api/src/server/ai/tutor.ts:121-144`.
- **Exploit:** a learner can invent the tutor's earlier replies to steer it off topic or have it
  print its instructions. They gain a general chatbot within their own allowance, nothing more.
- **Fix:** accept; or keep the conversation on the server.
- **Status:** open.

### 6. Content poisoning

- A question reaches learners only through a reviewer's approval in `/admin`. The content command
  line cannot publish. A drafted question is rejected unless its quote appears word for word in
  the source passage (`packages/content/src/schemas.ts:74`).

#### L5. Source text reaches the tutor unreviewed; drafting has no "data" guard (low)

- **Where:** `packages/api/src/server/ai/tutor.ts:44-53` (passages go to the tutor as soon as they
  are ingested), `packages/content/src/claude.ts:102` (the drafting prompt does not say the
  passage is data).
- **Exploit:** a source document carrying hidden instructions would be given to the tutor for
  every learner of that country, with only the "ignore instructions" line against it. Sources are
  official documents chosen by staff, which is why this is low.
- **Fix:** add the guard to the drafting prompt; give passages to the tutor only from documents a
  reviewer has accepted.
- **Status:** open.

### 7. AI cost abuse

#### H2. An AI request that is cut off is never counted, so the daily cap is optional (high)

- **Where:** `packages/api/src/server/ai/generator.ts:99-121` (usage is recorded only after the
  whole reply has been streamed), `tutor.ts:168-195`, `explain.ts:154-180`.
- **Exploit:** the daily allowance is the number of rows in `ai_usage`, and a row is written only
  when a reply finishes. A client that closes the connection after the first bytes leaves no row,
  while the model carries on and the full reply is paid for. A free account can do that ten
  times a minute for the tutor and twenty for explanations, all day: over 14,000 tutor requests
  from one free account instead of 15. Requests sent at the same moment also all pass the check
  before any of them is counted.
- **Fix:** count the request before calling the model, in the same statement that checks the
  allowance, and fill in the token numbers afterwards.
- **Status:** **fixed** in `a9ecfc1`, completed in `b48188a`. A request is recorded before the model is called (`reserveUsage` in `packages/api/src/server/ai/usage.ts`). The first version judged simultaneous requests by the order of their ids and a repeat run of the test caught two taking the last place; `b48188a` counts every visible record instead. Tests in `ai.db.test.ts`.

#### H3. No overall cap on AI spend (high)

- **Where:** `packages/core/src/ai-limits.ts`, `packages/api/src/server/ai/usage.ts`; the model
  call that screens posts (`packages/api/src/server/community.ts:52-66`) is not recorded at all.
- **Exploit:** accounts are free and unlimited in number, so per-account limits do not bound the
  bill. There is no per-address limit on AI and no total for the day.
- **Fix:** a daily total across all learners, after which free accounts are refused first; a
  limit per network address; record screening calls; alert at a share of the total.
- **Status:** **fixed** in `a9ecfc1` and `9a8715b`. A daily total for the whole service (`AI_DAILY_LIMIT`, default 5000 requests: free accounts pause past it, everyone past twice it), an alert through error reporting at 80% and 100%, a limit per network address on AI requests and on study-group writing, and off switches (`DISABLE_AI`, `DISABLE_AI_TUTOR`, `DISABLE_AI_EXPLANATIONS`, `DISABLE_COMMUNITY`). Not done: screening calls are still not written to `ai_usage`, so they are bounded by the posting limits and not by the daily total. The alert reaches nobody until Sentry is switched on (`docs/gaps_2026-10-09.md`, row 15).

#### L10. An AI explanation was given for questions outside the learner's plan (low)

- **Where:** `packages/api/src/server/ai/explain.ts` (`explain` checked that a question was
  published, not that the learner's plan included it). Found in the hands-on test, not in the
  code review.
- **Exploit:** a free account that knew a question's id was given its answer and the guide's
  passage, for questions outside the Free plan's sample: 20 a day.
- **Fix:** check the learner's access before explaining.
- **Status:** **fixed** in `b48188a`; tests in `ai.db.test.ts` and
  `apps/web/e2e/tests/security/access.spec.ts`.

### 8. Community abuse

- In place: every post and comment is screened before anyone else sees it, held if the model
  cannot be asked, and a row written directly is held by a trigger; reports, a moderators' queue,
  rate limits on posting, voting and reporting.
- Missing: blocking another learner (`docs/gaps_2026-10-09.md`, row 40).

#### M8. Post screening can be talked out of its verdict, and ignores personal data (medium)

- **Where:** `packages/api/src/server/community.ts:43-60`.
- **Exploit:** the post is placed between `<post>` tags without escaping, so a post containing
  `</post>` followed by instructions can try to dictate the verdict. And the three things screened
  for are toxicity, spam and legal advice: a post with a phone number, a home address or an
  immigration case number, the writer's or someone else's, passes.
- **Fix:** strip the tag from the text before sending it; add a `personal_data` verdict and a
  built-in pattern for case numbers, phone numbers and email addresses, held like the rest.
- **Status:** **fixed** in `6132640`. Tags inside a post are taken apart before it is sent; posts with an email address, a phone number or an immigration case number are held as `personal_data`, by pattern and by the model's verdict. Tests in `packages/core/src/community.test.ts` and `community.db.test.ts`. The patterns are English and US-leaning; the model covers the rest only when it is configured.
