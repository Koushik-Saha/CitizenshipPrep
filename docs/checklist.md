# Build checklist

A phase is done only when every box under it is ticked and its proof exists: a passing test, a
screenshot, a report file. Last checked 8 October 2026 against commit `90516f3`
([CI run](https://github.com/Koushik-Saha/CitizenshipPrep/actions/runs/37852359185), green).

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
- [~] **Name chosen and checked.** The name is Oathly. No record in the repository of a trademark,
  domain, store-name or social-handle check.

## Build phases (Section 5)

- [x] **P0** `CLAUDE.md` is in the repository root (untracked, on purpose).
- [~] **P1** `pnpm dev` runs web and Expo and both import from `packages/core`; CI is green on
  every push to `main`. Missing: no pull request has ever been opened, so "green on a test PR" has
  no proof.
- [x] **P2** Logo, icons, favicon and splash exist; light and dark tokens on `/brand`. Proof:
      `admin.spec.ts`, "the brand page is accessible" (both themes).
- [x] **P3** Proof: CI job "Migrations, RLS tests, generated types"; `db/tests/002_progress_isolation.test.sql`;
      `db/seed.sql` seeds AU, CA, DE, GB and US.
- [~] **P4** 20 US drafts, each with its source quote, from one guide, are in the local database
  and show in `/admin/content`. Missing: `/add-country` has not been run since it was rewritten
  (see P21).
- [~] **P5** One account works on web and in the phone app's browser build through the test
  sign-in. Missing: a real sign-up by emailed code, and a sign-in on a real phone.
- [x] **P6** Proof: `packages/core` coverage is enforced at 100% (234 tests);
      `exam-format.test.ts` and `mock-exam.test.ts` against the seeded formats.
- [~] **P7** Proof for the first half: `learner.spec.ts`, "a mock exam answered correctly is a
  pass". Missing: no test asserts that answering makes no blocking network call.
- [~] **P8** Proved by `ai.db.test.ts`: an explanation is generated once and reused; the tutor
  answers from study material only and refuses the rest. Proved by CI: no secret in any client
  bundle. Missing: first token under one second has never been measured.
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
- [~] **P14** Proof for the interview: `learner.spec.ts`, "a spoken exam opens as a mock
  interview". Audio and the offline queue have unit tests. Missing: audio played offline from a
  downloaded pack on a device.
- [~] **P15** Entitlement and cancellation logic is tested (`billing.db.test.ts`). Missing: a real
  test purchase on web and on mobile; RevenueCat is not configured.
- [ ] **P16** Community is not built.
- [x] **P17** Proof: `db/tests/004_accounts_orgs_community.test.sql` and `011_organizations.test.sql`;
      `org.spec.ts`.
- [x] **P18** Proof: `public.spec.ts`; Lighthouse SEO of 100 is enforced in CI.
- [x] **P19** Proof: CI green; axe runs on every page in both themes in the browser tests;
      `docs/security.md`.
- [ ] **P20** Nothing is deployed. The production database is empty. `docs/launch.md` lists the
      steps that are yours.
- [ ] **P21** `/add-country` has not been run end to end for a new country.

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
