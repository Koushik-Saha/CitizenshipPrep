# @oathly/api

What the web and mobile apps share about the signed-in learner.

- `@oathly/api` (safe anywhere, including the mobile app): the onboarding rules
  (`onboardingSchema`), the learner's shape (`Me`) and helpers such as `nextStep()`,
  the session state machine (`loadSession`), the client the mobile app uses to call the web
  app's `/api` routes, and the generated database types.
- `@oathly/api/server` (server only): reading and saving the learner's data, and checking the
  JWTs Neon Auth issues.

## Sign-in

Neon Auth (managed Better Auth) handles accounts.

|         | Web                                                            | Mobile                                                                               |
| ------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Methods | Email magic link, Google                                       | Emailed 6-digit code                                                                 |
| Session | Cookies set by `/api/auth/*` (Neon's Next.js SDK)              | Neon Auth's cookie in the platform cookie store                                      |
| Data    | Server Components and Server Actions call `@oathly/api/server` | `/api/me`, `/api/me/onboarding`, `/api/countries` with `Authorization: Bearer <JWT>` |

Both end at the same functions with the same user id (the Neon Auth user id, stored as
`profiles.id`), so a learner sees the same profile and progress on either. Mobile uses a code
instead of a link because a magic link opens in the browser, not the app.

Neon Auth does not offer Sign in with Apple. Apple's App Store guideline 4.8 can require it for
an iOS app that offers Google sign-in, so check this before submitting the iOS app.

## Configuration

Root `.env.local`: `NEON_AUTH_BASE_URL` (from the Neon console) and `NEON_AUTH_COOKIE_SECRET`
(32+ random characters). `apps/mobile/.env.local`: `EXPO_PUBLIC_NEON_AUTH_URL` (the same base
URL) and `EXPO_PUBLIC_API_URL` (the web app's origin; your computer's LAN address when testing
on a phone).

In the Neon console's Auth settings, enable the Email OTP and Magic Link plugins and add the web
app's origin to the trusted domains.
