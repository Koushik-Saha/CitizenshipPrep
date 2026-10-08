// Browser-side error reporting (Sentry). Without NEXT_PUBLIC_SENTRY_DSN this
// file is empty once built. With it, the SDK is fetched after the page is
// interactive, never before: error reporting is not on the critical path.
// Errors thrown before it arrives are kept and reported once it has.

import { privateByDefault } from './lib/sentry-options';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  const early: unknown[] = [];
  const keep = (event: ErrorEvent | PromiseRejectionEvent) => {
    if (early.length < 10) early.push('reason' in event ? event.reason : event.error);
  };
  addEventListener('error', keep);
  addEventListener('unhandledrejection', keep);

  const start = async () => {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      // Errors only: no traces, no session replays, no personal data.
      ...privateByDefault,
      dataCollection: { ...privateByDefault.dataCollection, httpBodies: [] },
    });
    removeEventListener('error', keep);
    removeEventListener('unhandledrejection', keep);
    for (const error of early) if (error) Sentry.captureException(error);
  };
  if ('requestIdleCallback' in window) requestIdleCallback(() => void start(), { timeout: 5000 });
  else setTimeout(() => void start(), 2500);
}
