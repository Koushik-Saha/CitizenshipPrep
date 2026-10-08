# Oathly mobile

The Expo app (iOS and Android). It runs the same quiz engine as the web app
(`packages/core`) and reads the same API through the same hooks
(`packages/api`): onboarding, dashboard, practice, flashcards, mock exams,
results, profile, and studying offline.

## Run it on a phone

The app talks to the web app's API, so start that first (from the repository
root, with the local database up):

```bash
pnpm db:start
pnpm --filter @oathly/web dev
```

Put the API's address in `apps/mobile/.env.local`. A phone cannot reach
`localhost`: use your computer's address on the Wi-Fi network both are on.

```bash
EXPO_PUBLIC_API_URL="http://192.168.1.20:3000"
EXPO_PUBLIC_NEON_AUTH_URL="<the same value as NEON_AUTH_BASE_URL>"
```

Then start Metro and scan the QR code with Expo Go:

```bash
pnpm --filter @oathly/mobile dev
```

### Without sign-in (development and tests)

Sign-in needs Neon Auth to be configured. To try the app before that, or to
run automated flows, use a test session. Start the web app with a secret:

```bash
TEST_SIGN_IN_SECRET="$(openssl rand -hex 32)" pnpm --filter @oathly/web dev
```

ask it for a token (any lowercase name gives a separate test learner):

```bash
curl "http://localhost:3000/api/test/sign-in?user=phone&secret=$TEST_SIGN_IN_SECRET&as=token"
```

and add it to `apps/mobile/.env.local`:

```bash
EXPO_PUBLIC_TEST_SESSION="test:phone.<signature>"
```

The app then opens signed in as that learner. This only works against a
development server started with the secret, and only in a development build
of the app: a release build ignores the variable.

## Offline

On the Study tab, "Save for offline" downloads a country pack: its published
questions, exam formats and your answer history. With a pack saved you can
practise, use flashcards and sit mock exams with no connection; sessions are
built on the phone by the same engine the server uses. Answers and results
wait in a queue on the phone and are sent when it is back online, sessions
first and then their answers. The Profile tab shows what is waiting.

## Audio mode

On a session screen, **Audio mode** reads each question and its choices
aloud, takes the answer by tap or by voice, then reads the explanation and
moves on. A mock exam whose real exam is spoken (an oral test or interview)
runs as a **mock interview**: each question is asked aloud in the exam's
language, with the written question and the choices out of sight until asked
for.

- Questions are read from recorded clips where they exist (`pnpm content
audio`), and by the phone's own voice (`expo-speech`) where they do not.
- Saving a country for offline also saves its clips, so audio mode works with
  no connection: `src/lib/audio-store.ts` (files on the phone; the browser's
  cache in the web build).
- Spoken answers use `expo-speech-recognition`, a native module that is **not
  in Expo Go**: there the microphone controls do not appear and answers are
  tapped. A development build (`npx expo run:ios` / `run:android`) has it.
- The sequencing lives in `packages/api` (`audio.ts`, `audio-hooks.ts`) and
  the matching of a spoken answer to an option in `packages/core`
  (`speech.ts`); `src/lib/audio-platform.ts` is only how this device plays,
  speaks and listens.

## Plans

The Plans screen (Profile, or the note under a country on the Free plan)
shows what the learner holds and sells Pro and Country Passes through the
App Store and Google Play, by way of RevenueCat (`src/lib/purchases.ts`).

- What a learner may use is never decided on the phone. The store takes the
  payment, RevenueCat tells the server, and the app reads the learner's plan
  from the server like everything else, so a plan bought on the web shows
  here and one bought here shows on the web.
- It needs RevenueCat's public SDK keys in `.env.local`:
  `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
  Without a key for the platform, plans are shown but cannot be bought.
- `react-native-purchases` is a native module: buying needs a development
  build, not Expo Go, and is not possible in the browser build.
- Store products are recognised by their identifiers: `…pro_monthly`,
  `…pro_yearly`, and one non-consumable per country, `…country_pass_<iso>`
  (for example `oathly_country_pass_us`). Setup is in
  `apps/web/scripts/billing/README.md`.

## Checks

```bash
pnpm --filter @oathly/mobile typecheck
pnpm --filter @oathly/mobile lint
```

**On a device, with Maestro.** With the app running in Expo Go under a test
session:

```bash
maestro test .maestro \
  -e APP_ID=host.exp.Exponent -e APP_URL=exp://192.168.1.20:8081
```

(`host.exp.exponent`, lower case, on Android.) There are four flows, each
starting from `.maestro/shared/open.yaml`, which opens the app and takes a new
test learner through onboarding:

| Flow              | What it does                                                     |
| ----------------- | ---------------------------------------------------------------- |
| `mock-exam.yaml`  | Starts a mock exam, answers every question, checks the results.  |
| `practice.yaml`   | A practice session: answer, check, next, through to the results. |
| `flashcards.yaml` | Turns each card over and rates it, through to the results.       |
| `plans.yaml`      | Opens the plans screen from the Profile tab and comes back.      |

They find elements by `testID`, never by a country's name.

**In a browser.** The app also runs under `react-native-web`, which is how it
is checked on machines without a simulator. It is the same screens and engine,
not the same rendering: gestures, haptics and performance still need a phone.

```bash
pnpm --filter @oathly/mobile web:setup        # once: copies Skia's WebAssembly runtime
EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @oathly/mobile web
pnpm --filter @oathly/mobile test:web         # the same four flows, with Playwright
```

## Error reporting

Set `EXPO_PUBLIC_SENTRY_DSN` to send errors to Sentry (`src/lib/monitoring.ts`).
Without it the SDK is never loaded. Reports carry the error and where it
happened: no traces, no screenshots, nothing that names the learner.

## Motion and the globe

- The welcome globe is React Three Fiber (`expo-gl` on phones). Land is drawn
  as points from `assets/globe/land-dots.json`, so there is no texture to
  load. Phones with reduced motion on, with little memory, or where WebGL
  fails to start show `assets/globe/poster.webp` instead. Both files come from
  `pnpm --filter @oathly/web globe:assets`.
- Everything else moves with Reanimated on the UI thread: the flashcard drag,
  flip and fly-off, option presses, the progress bar, the confetti. The
  readiness gauge and goal ring are drawn with Skia, driven by Reanimated
  shared values.
- Answers give haptic feedback (`src/lib/haptics.ts`); a mock exam gives the
  same light tap for every answer, since a real exam does not say whether you
  were right.

## Languages

The app's text comes from `packages/i18n`, the same message files as the web
app. It starts in the phone's language when Oathly has it, and the Profile
tab has a picker that changes it at once, with no restart. Arabic lays the
app out right to left through the `direction` style on the root view
(`src/lib/i18n.tsx`), not `I18nManager.forceRTL`, which would need a restart.

## Organizations

A learner who has joined an organization (through the invitation link, on
the website) sees "Studying with …" on the Study tab, with the
organization's logo and colours if it has set any. The colours come through
`BrandProvider` in `src/components/ui.tsx`, which swaps the theme's primary
and accent roles for shades that stay readable (`brandRoles` in
`@oathly/tokens`). A seat in an organization is Pro: the Plans screen says
who provides it and offers nothing to buy. Inviting, assigning and reports
are on the website only.
