# Security checklist

Reviewed 8 October 2026. Each line says what was checked, how, and where the
check lives so it keeps being run. "Open" items at the end are known gaps, not
oversights.

## Summary

| Area                                     | State                                           |
| ---------------------------------------- | ----------------------------------------------- |
| Row level security on every table        | Pass: 31 tables, 101 policies, tested           |
| No secrets in client bundles             | Pass: scanned on every CI build, web and mobile |
| Rate limiting on AI and auth endpoints   | Pass: added in this review, tested              |
| Input validation with Zod                | Pass for the API; see "Open" for Server Actions |
| Security headers                         | Pass: added in this review, tested              |
| Error reporting carries no personal data | Pass: Sentry's collection switched off, checked |

## Database

- **RLS on every table.** `db/tests/001_structure.test.sql` fails if any table
  in `public` has RLS off or no policy, so a new table cannot ship without it.
- **Signed-out visitors can change nothing and read only content.** The same
  file lists every grant to the `anonymous` role: `SELECT` on `countries`,
  `exam_formats`, `topics`, `questions`, `question_translations`, and nothing
  else. A new grant fails the test until it is added on purpose.
- **A learner's progress is theirs alone**, organization admins see only their
  own members, and members cannot see each other: `db/tests/002` to `013`
  (262 tests in all, run in CI's database job).
- **`SECURITY DEFINER` functions** pin their `search_path` and none is exposed
  in `public` (tested in `001`).
- **The server connects as the owner**, so RLS does not bind it. Every server
  function takes a verified user id and scopes its queries to it; the
  database-backed tests in `packages/api/src/server/*.db.test.ts` check the
  scoping (a learner finishing another's session, reading another's report).
- **Rate limit counters** (`rate_limits`) are granted to no client.

## Secrets

- **Nothing secret reaches a browser or a phone.**
  `scripts/security/client-bundles.mjs` reads every built client file and
  fails on the value of a server-only variable, on anything shaped like a
  credential (Stripe, Anthropic, Neon, Sentry, Google keys, database
  addresses with passwords, private keys), and on the _name_ of a server-only
  variable, which only appears when server code has been bundled for the
  client. CI runs it on the web build (built with marker values, so the check
  is not vacuous) and on the iOS and Android bundles.
- **Server-only variables have no public prefix.** Only `NEXT_PUBLIC_*` and
  `EXPO_PUBLIC_*` values are inlined into client code; the only ones defined
  are the Sentry DSN, the API origin and the Neon Auth address, all public.
- **`.env.local` is not in git**; `.env.example` documents every variable.
- **Invitation tokens** are stored as SHA-256 hashes; Stripe and RevenueCat
  webhooks verify their signature or secret before anything is read.

## Study groups

- **Nothing a learner writes is shown unscreened.** A post or comment is read by the model for
  abuse, spam and requests for legal advice before it is stored as visible; the text is passed as
  data to classify, and only a strict JSON verdict is accepted back. If the model cannot be
  asked, the post is held. A post written straight to the table by a signed-in client is held by
  a trigger.
- **A held post is hidden** from everyone but its writer and staff until a moderator decides, by
  Row Level Security as well as by the queries. Three reports from different learners hide a
  visible post the same way.
- **No legal advice.** A post about the writer's own immigration case is always held and is
  shown, once approved, with a notice to see a licensed attorney.
- A server with no model configured screens by built-in rules only. Production must have
  `ANTHROPIC_API_KEY` set.

## Rate limiting

Rules are in `packages/core/src/rate-limit.ts`; counters are in Postgres
(`takeRateLimit`), so they hold across server instances.

| What                           | Limit            | Counted by      |
| ------------------------------ | ---------------- | --------------- |
| Sign-in requests (`/api/auth`) | 30 in 5 minutes  | network address |
| Sign-in emails                 | 5 in 15 minutes  | recipient       |
| AI explanations                | 20 a minute      | learner         |
| Tutor messages                 | 10 a minute      | learner         |
| Exam results reported          | 10 an hour       | learner         |
| Account deletion               | 5 an hour        | learner         |
| Reviewer sign-in attempts      | 10 in 15 minutes | network address |
| Study-group posts              | 5 an hour        | learner         |
| Study-group comments           | 20 an hour       | learner         |
| Study-group upvotes            | 60 a minute      | learner         |
| Study-group reports            | 10 an hour       | learner         |

The AI limits sit on top of the daily allowances each plan includes. Network
and email addresses are counted under a keyed hash, never stored as
themselves. A refused call gets `429` with `Retry-After`. Tested in
`apps/web/e2e/tests/security.spec.ts` and
`packages/api/src/server/milestones.db.test.ts`.

## Input validation

- **Every API request body and every id in a path** is parsed with a Zod
  schema (`packages/api/src/schemas.ts`) before anything else reads it.
  Malformed input gets `400`; an id that is not an id gets `404`, where before
  this review it reached Postgres and came back as a `500`.
- **Answers from the offline queue** are checked one by one, so a malformed
  answer is refused for good while the rest of the batch is stored.
- **Starting a session from a form** goes through the same schema as the API.
- **All SQL is parameterised.** No query is built by joining strings with
  input.
- **Uploaded logos** are identified by their bytes, not their name or declared
  type, capped at 256 KB, and served with `nosniff` and a sandboxing policy.

## Requests and responses

- **Headers on every response** (`apps/web/next.config.ts`): a content
  security policy (no plugins, no framing, no `<base>` or form pointed
  elsewhere), `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy` (microphone for this site only,
  camera and location off), and HSTS in production. `X-Powered-By` is off.
- **Cross-site requests.** Session cookies are `SameSite=Lax`, and a request
  that changes something with a cookie session is refused when the browser
  says it came from another site (`isCrossSite` in `lib/api-auth.ts`).
- **The test sign-in** exists only on a development server started with its
  secret. A production build answers `404` even with the secret set (checked
  against a production build in this review).
- **The publish webhook and the review pages** compare secrets in constant
  time.

## Account deletion

- A learner can delete their account from the website (Account) and the phone
  app (Profile), without writing to anyone. It removes their profile and
  everything that hangs off it in one transaction
  (`packages/api/src/server/account.ts`, tested in `account.db.test.ts`).
- It is refused, with nothing deleted, for an owner of an organization that
  has members or paid seats, and for a reviewer whose verification record has
  to be kept.
- A request another site makes with the learner's cookie cannot delete the
  account (tested).

## Error reporting and analytics

- **Sentry** is off without a DSN. With one, reports carry the error and
  where it happened. Cookies, headers, query strings, request bodies and user
  details are switched off explicitly (`lib/sentry-options.ts`): this SDK
  version collects all of them by default. Checked by sending a request with a
  cookie, a password in its body and an email in its query to a route that
  throws, and reading the report: none of the three was in it.
- **PostHog** events are sent from the server only, keyed by account id:
  `signup`, `first_question_answered`, `mock_exam_completed`, `upgrade`,
  `pass_reported` (and `fail_reported`). No name, email or answer is sent, and
  nothing is added to what the browser or the phone downloads.

## Open

- **The content security policy allows inline scripts.** The public pages are
  built ahead of time; a nonce per request would mean rendering every page on
  demand. Accepted for now.
- **The rate limiter trusts `X-Forwarded-For`.** That is right behind a host
  that sets it (Vercel does). Behind anything else, check it cannot be forged.
- **The phone app signs in with Neon Auth directly**, not through this site's
  proxy, so its sign-in is limited by Neon Auth's rules, not the table above.
- **Server Actions for organizations and content review validate by hand**
  (tested functions in `packages/core` and `packages/api`), not with Zod.
  Review actions are behind the reviewers' sign-in.
- **The review pages use one shared account** (`ADMIN_USERNAME`,
  `ADMIN_PASSWORD`), entered on their own sign-in page and kept in a signed,
  HTTP-only cookie for twelve hours. Guesses are limited to ten in fifteen
  minutes per network address. Per-person reviewer accounts would be better.
- **Four dependency advisories** (`pnpm audit --prod`, 2 high, 2 moderate):
  `node-forge`, `braces`, `uuid`, `decode-uri-component`, all inside Expo's
  build tooling, none in code that runs for a learner. Two have no fixed
  release yet. Revisit when the Expo SDK is next upgraded.
- **Source maps are not uploaded**, so stack traces from production are
  minified until `SENTRY_AUTH_TOKEN` is set (web) and the Sentry build plugin
  is added (mobile).
- **Accessibility is checked by axe**, which finds what a machine can. A pass
  with a screen reader on a phone has not been done.
- **The Maestro flows have not been run on a device** (no simulator on the
  machine they were written on). The same four flows pass against the
  browser build (`apps/mobile/e2e/flows.web.mjs`).
