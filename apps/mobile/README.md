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

## Checks

```bash
pnpm --filter @oathly/mobile typecheck
pnpm --filter @oathly/mobile lint
```

**On a device, with Maestro.** With the app running in Expo Go under a test
session:

```bash
maestro test .maestro/mock-exam.yaml \
  -e APP_ID=host.exp.Exponent -e APP_URL=exp://192.168.1.20:8081
```

(`host.exp.exponent`, lower case, on Android.) The flow starts a mock exam,
answers every question and checks the results screen.

**In a browser.** The app also runs under `react-native-web`, which is how it
is checked on machines without a simulator. It is the same screens and engine,
not the same rendering: gestures, haptics and performance still need a phone.

```bash
pnpm --filter @oathly/mobile web:setup        # once: copies Skia's WebAssembly runtime
EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm --filter @oathly/mobile web
pnpm --filter @oathly/mobile test:web         # the Maestro flow, with Playwright
```

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
