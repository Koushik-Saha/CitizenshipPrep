# Security sign-off

9 October 2026. A second pass over `docs/security_audit_2026-10-09.md` and
`docs/pentest_2026-10-09.md`, after the fixes: each finding was checked again against the code as
it now stands and against a running server, not against the "fixed" lines in those documents.

## Verdict: NO-GO for launch. The security review itself is clear.

- **Security findings: 0 critical, 0 high open.** The three high findings were each re-tested by
  hand and hold. On security alone the rule for GO is met.
- **Launch: NO-GO.** `docs/gaps_2026-10-09.md` still has 16 launch-blockers and 18 high items
  open, and its rows 1 to 16 are untouched. Nothing is published, nothing can be bought, sign-in on
  the live site is unconfirmed, and the legal texts are unreviewed. Those decide launch, and none
  of them is closed.
- **Five medium security findings are open**, two of them waiting on a decision from you (M1, M2).
  They do not block by the rule, but M1 and M2 start to matter the day content is published and
  learners sign up.

## What this sign-off is not

- **Not independent.** The same reviewer wrote the audit, the fixes and this check. It was done
  as a fresh pass (new accounts, the attempts made again, the code re-read), but a second person
  has not looked. Before real money and real learners depend on it, have someone else repeat
  `docs/pentest_2026-10-09.md`: it is written to be repeated.
- **Not on staging.** There is no staging environment. "Running server" means a local
  development server on a scratch local database with the same migrations. Production was checked
  only for what is safe to read: the deploy is the reviewed commit (`0027087`), the new migration
  is applied, and signed-out requests are refused.
- **Not on a phone.** The phone app has never run on a device; everything about it is from its
  code.
- **Not of Neon Auth's own settings** (trusted domains, session length, sign-out), which need the
  live project.

## Every original finding

"Verified" says what was done in this pass.

| Id  | Severity | Finding                                         | Status now                   | Verified by                                                                                                                                                              |
| --- | -------- | ----------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1  | high     | A post rewritten after moderation               | **Fixed**                    | As a new user, rewrote my own visible post directly: refused. Database test 015 (17 cases) passes. The migration is applied to production.                               |
| H2  | high     | A cut-off AI request is never counted           | **Fixed**                    | One message left, four sent and hung up on: 1 answered, 3 refused, and the one was counted. Five sent at once: none over the limit, in six test runs and by hand.        |
| H3  | high     | No overall cap on AI spend                      | **Fixed**, in part           | Server restarted with a daily limit of 0: an explanation was refused with "paused" and nothing was left counted. Screening calls are still outside the total (see N1).   |
| M1  | medium   | Anyone can read every published question        | Open                         | Re-tested: a visitor with no account still reads all 30 test questions and answers directly.                                                                             |
| M2  | medium   | All profiles listable; any display name         | Open                         | Re-tested: 8 other profiles readable; a display name set directly, unscreened, and shown to others (as text).                                                            |
| M3  | medium   | Payment event marked handled before applied     | **Fixed**                    | Test with a database that drops the write once: the retry now counts, for Stripe and RevenueCat. The test fails on the old code.                                         |
| M4  | medium   | Test purchases unlock Pro                       | **Fixed**                    | A correctly authorized `SANDBOX` purchase sent to the server: ignored, no plan.                                                                                          |
| M5  | medium   | Invitations as a mail relay                     | Open                         | Code unchanged. Not exploitable until email is configured.                                                                                                               |
| M6  | medium   | Rate limiter fails open                         | **Fixed** for AI and posting | Read in `apps/web/src/lib/rate-limit.ts` and its callers. Not exercised: it needs the database to fail. Sign-in still fails open, by design.                             |
| M7  | medium   | One shared reviewer password                    | Open                         | Code unchanged.                                                                                                                                                          |
| M8  | medium   | Screening ignores personal data; tag break-out  | **Fixed**                    | With the real model: posts with a phone number, a case number, and a named neighbour's address were each held; a post closing its own tag to dictate a verdict was held. |
| M9  | medium   | CSP allows inline scripts, any HTTPS connection | Open, accepted               | Headers unchanged on the live site.                                                                                                                                      |
| L1  | low      | Three reports hide a post                       | Open                         | Code unchanged.                                                                                                                                                          |
| L2  | low      | Session score taken from the client             | Open                         | Code unchanged.                                                                                                                                                          |
| L3  | low      | Phone session not in secure storage             | Open                         | Code unchanged.                                                                                                                                                          |
| L4  | low      | No limit on answers, sessions, packs, flags     | Open                         | Code unchanged.                                                                                                                                                          |
| L5  | low      | Source text reaches the tutor unreviewed        | Open                         | Code unchanged.                                                                                                                                                          |
| L6  | low      | Tutor accepts client-written history            | Open                         | Re-tested: a made-up "developer mode" reply still got only the off-topic sentence.                                                                                       |
| L7  | low      | Invitation tokens in page addresses             | Open                         | Code unchanged.                                                                                                                                                          |
| L8  | low      | Four advisories in build tooling                | Open                         | `pnpm audit --prod` unchanged.                                                                                                                                           |
| L9  | low      | Staff could publish through the Data API        | Open                         | Code unchanged. No such account exists.                                                                                                                                  |
| L10 | low      | Explanations outside the learner's plan         | **Fixed**                    | As a free user, asked for an explanation of a question outside the sample: 404. Covered by a database test and a browser test.                                           |

The rest of the hands-on test was repeated as well: of 48 attempts, 45 now hold. The three that
do not are M1 and M2 above. Forged and replayed webhooks, other learners' sessions, plans and
organizations, the reviewers' pages, and script in posts, comments and names all held again.

The off switches were checked on a restarted server: with `DISABLE_AI_TUTOR` and
`DISABLE_COMMUNITY` set, the tutor answered 503 and the tutor and study-group pages showed "Page
not found", while the rest of the app worked.

## New findings from this pass

All come from the fixes themselves. None is critical or high.

| Id  | Severity | Finding                                                                                                                                                                                                                                                                            | Fix                                                                                                               |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| N1  | medium   | The daily limit swaps a cost risk for an availability one. Someone with a few addresses and many free accounts can use up the day's 5000 requests and pause AI help for every free learner. Pro learners keep working up to twice the limit. Screening calls are not in the total. | Keep the limit (it bounds the bill). Add a smaller daily allowance for accounts under a day old; count screening. |
| N2  | low      | A request is counted before the model is called, so when the model fails the learner has still used one of the day's requests.                                                                                                                                                     | Give the request back when the model itself fails.                                                                |
| N3  | low      | AI requests are limited to 120 an hour per network address. A classroom behind one address shares that, and organizations are a customer.                                                                                                                                          | Lift the address limit for learners who hold an organization's seat.                                              |
| N4  | low      | The off switches take a redeploy (about a minute), and the dashboard still links to a switched-off page.                                                                                                                                                                           | Keep the switches in the database, and hide the links.                                                            |
| N5  | low      | More posts are held now (personal details), and nobody is told when one is waiting: a held post sits until someone opens `/admin/community`.                                                                                                                                       | Email or alert moderators when the queue is not empty.                                                            |
| N6  | low      | When a payment event is handled again after a failure, the "upgrade" analytics event can be sent twice.                                                                                                                                                                            | Send it only on the first successful handling.                                                                    |

## Checks run

- Database tests: 296 pass (16 files), including the new `015_direct_access`.
- Unit and database-backed tests: `@oathly/core` 279, `@oathly/api` 285, `@oathly/content`
  111, all passing; coverage thresholds held.
- Browser tests: the 7 new ones in `apps/web/e2e/tests/security/`, with the existing security and
  study-group tests, 24 in all, pass locally. CI ran the full set on `0027087`: green.
- Typecheck and lint: clean.

## What you must do by hand

- **Nothing to rotate.** No secret was found in the repository or its history.
- **Decide M1 and M2.** The simplest close for both: Neon console > Data API > switch it off.
  Nothing in this repository uses it. Say if you would rather keep it on, and the grants can be
  tightened in a migration instead.
- **Before store review:** set `REVENUECAT_SANDBOX_USERS` to the review account's id, or the
  reviewer's test purchase will give them nothing.
- **Switch on Sentry** on the host, or the new AI spend alerts go nowhere.
- **Set a spend limit in the Anthropic console** as the last line behind the app's own.
