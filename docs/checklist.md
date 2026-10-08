# Build checklist

A phase is done only when every box under it is ticked and its proof exists: a passing test, a
screenshot, a report file. Last checked 8 October 2026.

- `[x]` done, with the proof named
- `[~]` partly done: what is missing is named
- `[ ]` not done

Two standing differences from the playbook's wording: the database is Neon, not Supabase, and
`CLAUDE.md` and `.claude/` are kept out of git on purpose.

## Setup (Section 4)

- [~] **All accounts created.** Evidence here for GitHub (the repository and CI), Anthropic and
  Stripe (keys set in `.env.local`), and Neon in place of Supabase. No sign in this repository or
  its environment of Vercel, Expo/EAS, Apple Developer, Google Play, RevenueCat, PostHog or Sentry:
  no keys are set for the last three, and the `eas` and `vercel` tools are not installed.
- [~] **Tools installed.** Node 24.21, pnpm 12.5, Git and Claude Code are. Xcode is not (only the
  command-line tools), and Android Studio is not. Expo Go is on a phone and cannot be checked from
  here.
- [~] **MCP servers.** Playwright and Context7 connect. Supabase is configured but fails to connect
  (and is not the database any more). The GitHub server is present but not signed in; the `gh`
  tool is used instead.
- [~] **Name chosen and checked.** Checked on 8 October 2026: `docs/proof/name-check.md`. It
  found a problem: another app, "Oathly: Habit Accountability", has been on the App Store and
  Google Play since 14 September 2026, and oathly.com is held by a name marketplace. Trademark
  registers were not searched. Yours to decide before store submission.

## Build phases (Section 5)

- [x] **P0** `CLAUDE.md` is in the repository root (untracked, on purpose).
- [x] **P1** `pnpm dev` runs web and Expo and both import from `packages/core`. Proof of CI on a
      pull request: [#1](https://github.com/Koushik-Saha/CitizenshipPrep/pull/1), all four jobs green.
- [x] **P2** Logo, icons, favicon and splash exist; light and dark tokens on `/brand`. Proof:
      `admin.spec.ts`, "the brand page is accessible" (both themes).
- [x] **P3** Proof: CI job "Migrations, RLS tests, generated types"; `db/tests/002_progress_isolation.test.sql`;
      `db/seed.sql` seeds AU, CA, DE, GB and US.
- [x] **P4** 20 US drafts, each with its source quote, from one guide, are in the local database
      and show in `/admin/content`. `/add-country` was run end to end for Australia in an empty
      database: proof in `docs/proof/add-country-AU.md`, with the two faults the run found and fixed.
- [x] **P5** Proved with a real account on 8 October 2026: signed up on the web by emailed code,
      then signed in on the phone app's own sign-in screen (browser build) by a second emailed code,
      and landed in the same account with the study country and daily goal set on the web. Proof:
      `docs/proof/phone-sign-in-by-emailed-code.png`. The run found that the API refused every real
      phone token (it looked for the sign-in service's keys at the wrong address); fixed, with a test
      in `tokens.test.ts`. On a real phone: see P12.
- [x] **P6** Proof: `packages/core` coverage is enforced at 100% (234 tests);
      `exam-format.test.ts` and `mock-exam.test.ts` against the seeded formats.
- [x] **P7** Proof: `learner.spec.ts`, "a mock exam answered correctly is a pass" and "answering
      never waits for the network", which holds every answer on its way to the server and answers
      three questions with nothing getting through.
- [x] **P8** Measured on 8 October 2026 with `apps/web/scripts/perf/first-token.mjs` on eight
      questions: first token at a median of 525 ms (slowest 645 ms); asked again, answered from the
      cache in a median of 27 ms. Output in `docs/proof/first-token.txt`. Proved by `ai.db.test.ts`:
      the tutor answers from study material only and refuses the rest. Proved by CI: no secret in any
      client bundle.
- [x] **P9** Proof: `packages/core/src/readiness.test.ts`.
- [ ] **P10** Lighthouse mobile performance of 90 or more is enforced in CI. Not met: landing
      JavaScript is 141.5 KiB against 130; the mobile LCP limit CI can hold is 3.5 s against a target
      of 1.5 s. Not proved: the poster with WebGL off.
- [x] **P11** Proof: CI job "Performance budgets" runs the JavaScript budget, Lighthouse for
      mobile and desktop, and `navigation.mjs`, which fails at 100 ms. The numbers are in each run's
      log and its `lighthouse-reports` artifact, not in a file in the repository.
- [ ] **P12** No real iPhone or Android run. This Mac has no simulators either.
- [x] **P13** Ten interface languages. Proof: `learner.spec.ts`, "the study pages work in a
      right-to-left language"; `public.spec.ts`, "pages come in the reader's language, with questions
      translated where reviewed".
- [x] **P14** Proof for the interview: `learner.spec.ts`, "a spoken exam opens as a mock
      interview". Proof for offline audio: the "offline" flow in `apps/mobile/e2e/flows.web.mjs` saves
      a pack, cuts the connection, turns audio mode on and answers ten questions with no request
      reaching the server, then reconnects and sees the answers sent. That is the phone app in a
      browser; on a real phone it is part of P12.
- [~] **P15** Entitlement and cancellation logic is tested (`billing.db.test.ts`): a purchase on
  either side unlocks the other, and a cancellation runs to the end of its period. Missing: a real
  test purchase. That needs Stripe prices for the plans and a RevenueCat project with store
  products, which are yours to set up with the store accounts.
- [ ] **P16** Community is not built.
- [x] **P17** Proof: `db/tests/004_accounts_orgs_community.test.sql` and `011_organizations.test.sql`;
      `org.spec.ts`.
- [x] **P18** Proof: `public.spec.ts`; Lighthouse SEO of 100 is enforced in CI.
- [x] **P19** Proof: CI green; axe runs on every page in both themes in the browser tests;
      `docs/security.md`.
- [ ] **P20** Nothing is deployed. The production database is empty. `docs/launch.md` lists the
      steps that are yours.
- [~] **P21** Run end to end for Australia in an empty database (`docs/proof/add-country-AU.md`).
  Missing: a run for a country the product does not have yet, against the real content database.
  That needs you to supply the country's official guide.

## Content per country (Section 7)

The world survey (R1) covered 197 countries: 46 have a profile, 14 are confirmed to have no test,
137 are still unclear. No country has been taken past R1, so every R2 to R8 box is empty.

R1 asks for every field cited. No profile is there yet: each has facts recorded as not confirmed,
with the reason. The R1 column gives the confidence and how many facts are still open.

| Country                 | R1 profile     | R2 sources | R3 official | R4 original | R5 fact-check | R6 content | R7 translated | R8 freshness | Published by review |
| ----------------------- | -------------- | ---------- | ----------- | ----------- | ------------- | ---------- | ------------- | ------------ | ------------------- |
| Albania (AL)            | low, 7 open    |            |             |             |               |            |               |              |                     |
| Andorra (AD)            | medium, 6 open |            |             |             |               |            |               |              |                     |
| Armenia (AM)            | medium, 4 open |            |             |             |               |            |               |              |                     |
| Australia (AU)          | high, 4 open   |            |             |             |               |            |               |              |                     |
| Austria (AT)            | high, 2 open   |            |             |             |               |            |               |              |                     |
| Bhutan (BT)             | medium, 5 open |            |             |             |               |            |               |              |                     |
| Canada (CA)             | high, 5 open   |            |             |             |               |            |               |              |                     |
| Colombia (CO)           | high, 4 open   |            |             |             |               |            |               |              |                     |
| Costa Rica (CR)         | high, 4 open   |            |             |             |               |            |               |              |                     |
| Croatia (HR)            | high, 3 open   |            |             |             |               |            |               |              |                     |
| Cyprus (CY)             | high, 6 open   |            |             |             |               |            |               |              |                     |
| Czechia (CZ)            | high, 5 open   |            |             |             |               |            |               |              |                     |
| Denmark (DK)            | high, 4 open   |            |             |             |               |            |               |              |                     |
| Dominican Republic (DO) | high, 4 open   |            |             |             |               |            |               |              |                     |
| Ecuador (EC)            | high, 3 open   |            |             |             |               |            |               |              |                     |
| Estonia (EE)            | high, 4 open   |            |             |             |               |            |               |              |                     |
| France (FR)             | high, 4 open   |            |             |             |               |            |               |              |                     |
| Georgia (GE)            | high, 4 open   |            |             |             |               |            |               |              |                     |
| Germany (DE)            | high, 1 open   |            |             |             |               |            |               |              |                     |
| Greece (GR)             | medium, 4 open |            |             |             |               |            |               |              |                     |
| Honduras (HN)           | medium, 5 open |            |             |             |               |            |               |              |                     |
| Hungary (HU)            | high, 2 open   |            |             |             |               |            |               |              |                     |
| Kazakhstan (KZ)         | high, 4 open   |            |             |             |               |            |               |              |                     |
| Latvia (LV)             | high, 4 open   |            |             |             |               |            |               |              |                     |
| Liechtenstein (LI)      | medium, 6 open |            |             |             |               |            |               |              |                     |
| Lithuania (LT)          | medium, 6 open |            |             |             |               |            |               |              |                     |
| Luxembourg (LU)         | high, 6 open   |            |             |             |               |            |               |              |                     |
| Mexico (MX)             | high, 4 open   |            |             |             |               |            |               |              |                     |
| Moldova (MD)            | high, 5 open   |            |             |             |               |            |               |              |                     |
| Netherlands (NL)        | high, 5 open   |            |             |             |               |            |               |              |                     |
| Norway (NO)             | high, 6 open   |            |             |             |               |            |               |              |                     |
| Panama (PA)             | medium, 5 open |            |             |             |               |            |               |              |                     |
| Peru (PE)               | medium, 7 open |            |             |             |               |            |               |              |                     |
| Romania (RO)            | medium, 7 open |            |             |             |               |            |               |              |                     |
| Russia (RU)             | high, 6 open   |            |             |             |               |            |               |              |                     |
| Seychelles (SC)         | high, 5 open   |            |             |             |               |            |               |              |                     |
| Slovakia (SK)           | medium, 4 open |            |             |             |               |            |               |              |                     |
| South Korea (KR)        | medium, 4 open |            |             |             |               |            |               |              |                     |
| Spain (ES)              | high, 4 open   |            |             |             |               |            |               |              |                     |
| Sweden (SE)             | high, 3 open   |            |             |             |               |            |               |              |                     |
| Switzerland (CH)        | medium, 5 open |            |             |             |               |            |               |              |                     |
| Taiwan (TW)             | medium, 8 open |            |             |             |               |            |               |              |                     |
| Ukraine (UA)            | high, 6 open   |            |             |             |               |            |               |              |                     |
| United Kingdom (GB)     | high, 4 open   |            |             |             |               |            |               |              |                     |
| United States (US)      | high, 2 open   |            |             |             |               |            |               |              |                     |
| Vanuatu (VU)            | medium, 4 open |            |             |             |               |            |               |              |                     |

- **R8** The monthly scheduled task that exists (`.github/workflows/source-check.yml`) rechecks
  study guides stored in the database. It does not yet run over `data/sources/`, and no country has
  a pack there.
- **Published by review** Nothing is published in the production database. There is not yet a way
  to load `data/questions/` files into the review queue, so this box cannot be ticked for any
  country until that exists.

## Launch (Section 6)

- [ ] Every box in "Before you launch" ticked
- [ ] App Store and Google Play approval received
- [ ] Analytics shows a real user reaching signup, first question and mock exam
