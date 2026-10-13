# Production check, signed out

12 October 2026, against `https://oathly.vercel.app`, with Playwright (a real browser for the
pages, its request client for headers and endpoints). Every request was made as a visitor with
no account. Nothing was signed in to and nothing was changed.

"Read-only" needs one note: endpoints that only accept `POST` were sent an empty `POST` with no
credentials, because a `GET` to them says nothing about who may use them. Each was refused before
doing any work. The sign-in service's own endpoints were only read.

## Result

| Check                                                   | Result                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| `/admin` and every `/admin/*` route redirect to sign-in | **Pass**: all nine tried, including made-up ones                |
| The six security headers on `/`                         | **Pass**: all six are set. Nothing to add to `next.config.ts`   |
| `/.env`, `/.git/config` and similar                     | **Pass**: 404, no file contents                                 |
| `/api/*` answers 401 or 404 to a visitor                | **Pass, with four endpoints that are open on purpose or unset** |

One small change came out of it: see "Changed" below.

## The reviewers' area

Each was asked for with no cookies. "First answer" is the server's own response; "ends at" is
where a browser lands.

| Path                                          | First answer                   | Ends at                          |
| --------------------------------------------- | ------------------------------ | -------------------------------- |
| `/admin`                                      | 307 to `/admin/sign-in`        | Sign-in page                     |
| `/admin/content`                              | 307 to `/admin/sign-in?next=…` | Sign-in page                     |
| `/admin/content?view=source`                  | 307 to `/admin/sign-in?next=…` | Sign-in page                     |
| `/admin/content/questions/<id>`               | 307 to `/admin/sign-in?next=…` | Sign-in page                     |
| `/admin/content/translations/<id>/es`         | 307 to `/admin/sign-in?next=…` | Sign-in page                     |
| `/admin/community`                            | 307 to `/admin/sign-in?next=…` | Sign-in page                     |
| `/admin/flags`, `/admin/users` (do not exist) | 307 to `/admin/sign-in?next=…` | Sign-in page                     |
| `/admin/anything/else` (does not exist)       | 307 to `/admin/sign-in?next=…` | Sign-in page                     |
| `/es/admin`                                   | 404                            | "Page not found"                 |
| `/admin/sign-in`                              | 200                            | Sign-in page (it has to be open) |

The redirect comes from the request proxy, which guards the whole `/admin` prefix, so a route
added later is covered without anyone remembering to. There is no `/api/admin`: the reviewers'
actions are form posts to those same pages, and `/api/admin` and `/api/admin/users` answer 404.

## Headers on `/`

Read from the 200 response.

| Header                      | Set | Value                                                                                                                                                      |
| --------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | Yes | `default-src 'self'`; scripts and styles from this site and inline; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'` |
| `Strict-Transport-Security` | Yes | `max-age=63072000; includeSubDomains; preload`                                                                                                             |
| `X-Frame-Options`           | Yes | `DENY`                                                                                                                                                     |
| `X-Content-Type-Options`    | Yes | `nosniff`                                                                                                                                                  |
| `Referrer-Policy`           | Yes | `strict-origin-when-cross-origin`                                                                                                                          |
| `Permissions-Policy`        | Yes | `camera=(), geolocation=(), microphone=(self), payment=(), usb=(), browsing-topics=()`                                                                     |

Also: no `X-Powered-By`, and no `Access-Control-Allow-Origin` (other sites cannot read the API
from a browser).

Still open from the security review (finding M9 in `docs/security_audit_2026-10-09.md`): the
policy allows inline scripts, because the public pages are built ahead of time and a per-request
nonce would mean rendering each on demand. The header is present; it is weaker against an
injected script than a nonce-based one would be.

## Files that must not be served

| Path                    | Answer |
| ----------------------- | ------ |
| `/.env`                 | 404    |
| `/.env.local`           | 404    |
| `/.env.production`      | 404    |
| `/.git/config`          | 404    |
| `/.git/HEAD`            | 404    |
| `/.vercel/project.json` | 404    |
| `/package.json`         | 404    |
| `/next.config.ts`       | 404    |

None returned anything that looked like a file.

## API endpoints, as a visitor

| Endpoint                               | Answer | Note                                                                                                                                                                                  |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/answers`                    | 401    |                                                                                                                                                                                       |
| `POST /api/attempts/<id>/complete`     | 401    |                                                                                                                                                                                       |
| `GET /api/countries`                   | 401    |                                                                                                                                                                                       |
| `POST /api/explain`                    | 401    |                                                                                                                                                                                       |
| `GET /api/me`, `DELETE /api/me`        | 401    |                                                                                                                                                                                       |
| `POST /api/me/exam-result`             | 401    |                                                                                                                                                                                       |
| `POST /api/me/onboarding`              | 401    |                                                                                                                                                                                       |
| `POST /api/me/time-zone`               | 401    |                                                                                                                                                                                       |
| `GET /api/orgs/<id>/report`            | 401    |                                                                                                                                                                                       |
| `GET /api/packs/US`                    | 401    |                                                                                                                                                                                       |
| `GET /api/study/dashboard`             | 401    |                                                                                                                                                                                       |
| `GET /api/study/sessions/<id>`         | 401    |                                                                                                                                                                                       |
| `POST /api/study/sessions`             | 401    |                                                                                                                                                                                       |
| `POST /api/study/sessions/offline`     | 401    |                                                                                                                                                                                       |
| `POST /api/tutor`                      | 401    |                                                                                                                                                                                       |
| `POST /api/billing/revenuecat/webhook` | 401    | No secret sent                                                                                                                                                                        |
| `POST /api/revalidate`                 | 401    | No secret sent                                                                                                                                                                        |
| `GET /api/test/sign-in`                | 404    | The development-only sign-in does not exist in production                                                                                                                             |
| `GET /api`, `/api/does-not-exist`      | 404    |                                                                                                                                                                                       |
| `GET /api/admin`, `/api/admin/users`   | 404    |                                                                                                                                                                                       |
| `GET /api/audio/<id>`                  | 404    | **Open on purpose.** A clip is a published question read aloud; an unknown id is not found                                                                                            |
| `GET /api/orgs/<id>/logo`              | 404    | **Open on purpose.** A logo is shown before sign-in; an unknown id is not found                                                                                                       |
| `GET /api/public/countries`            | 200    | **Open on purpose.** The public facts about each exam, for the phone app's first screen                                                                                               |
| `GET /api/auth/get-session`            | 200    | **Open on purpose.** The sign-in service answering "nobody is signed in" (`null`)                                                                                                     |
| `POST /api/billing/stripe/webhook`     | 503    | **Not set up.** "Billing is not set up": the Stripe settings are missing on the host. Once they are set this answers 400 to anything unsigned. See `docs/billing_check_2026-10-12.md` |

So every endpoint that holds a learner's data, costs money to call, or changes anything answers
401 without a session. The four open ones return nothing private.

## Seen along the way

- After about sixty requests in a few minutes, Vercel's firewall began answering 403 with its
  "Security Checkpoint" page to this address. It had lifted when the headers were read again
  later the same day. That is the host protecting the site. The checkpoint page is Vercel's own
  and does not carry the site's headers.
- With a language chosen (the cookie, or a browser that asks for Spanish, say), `/.git/config`
  and `/api` were first redirected to `/es/…` and only then not found. Nothing leaked, but a
  path like that has no business being redirected.

## Changed

`apps/web/src/proxy.ts`: a path that starts with a dot (other than `/.well-known/`), and `/api`
on its own, now answers 404 at once, whatever language is asked for. Test: "hidden files and
made-up API paths are not found, whatever language is asked for" in
`apps/web/e2e/tests/security.spec.ts`.

`next.config.ts` was not changed: no header was missing.
