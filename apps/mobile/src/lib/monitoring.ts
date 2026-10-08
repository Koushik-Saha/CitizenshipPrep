// Error reporting (Sentry) for the phone app. Switched on by
// EXPO_PUBLIC_SENTRY_DSN; without it the SDK is never loaded and nothing is
// sent, which is how the app runs on a laptop and in tests.
//
// Errors only: no performance traces, no screenshots, and nothing that says
// who the learner is beyond what an error's own message holds.

import type { ComponentType } from 'react';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

type SentryModule = typeof import('@sentry/react-native');

/** The SDK, loaded only when there is somewhere to report to. */
function sentry(): SentryModule | null {
  if (!dsn) return null;
  // Loaded on demand rather than imported, so a build with no DSN leaves it out of the start-up path.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@sentry/react-native') as SentryModule;
}

let started = false;

/** Starts error reporting. Call once, before the first screen renders. */
export function startMonitoring(): void {
  const Sentry = sentry();
  if (!Sentry || started) return;
  started = true;
  Sentry.init({
    dsn,
    environment:
      process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? (__DEV__ ? 'development' : 'production'),
    tracesSampleRate: 0,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
  });
}

/** Wraps the root component so that an error while rendering is reported, not only shown. */
export function withMonitoring<Props extends Record<string, unknown>>(
  Root: ComponentType<Props>,
): ComponentType<Props> {
  const Sentry = sentry();
  return Sentry ? (Sentry.wrap(Root) as ComponentType<Props>) : Root;
}

/** Reports an error that was handled but that someone should still see. */
export function reportError(error: unknown): void {
  sentry()?.captureException(error);
}
