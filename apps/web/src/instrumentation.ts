import type { Instrumentation } from 'next';

import { privateByDefault } from './lib/sentry-options';

// Server-side error reporting (Sentry). Without SENTRY_DSN nothing is loaded
// and nothing is sent. See lib/monitoring.ts for errors reported by hand.

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
    ...privateByDefault,
    dataCollection: { ...privateByDefault.dataCollection, httpBodies: [] },
  });
}

/** Errors thrown while rendering a page or answering a request. */
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
  await Sentry.flush(2000);
};
