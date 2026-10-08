// Error reporting (Sentry), from server code. It is switched on by SENTRY_DSN
// and does nothing without it, so a laptop or CI reports to nobody. The SDK is
// only loaded when there is somewhere to send to.

export const isMonitoringConfigured = () => Boolean(process.env.SENTRY_DSN);

/**
 * Reports an error that was handled (the request carried on) but that someone
 * should still see. `context` must not carry personal data: ids and names of
 * things, never a learner's words or address.
 */
export function reportError(error: unknown, context: Record<string, string> = {}): void {
  console.error(error);
  if (!isMonitoringConfigured()) return;
  void import('@sentry/nextjs')
    .then((Sentry) => Sentry.captureException(error, { tags: context }))
    .catch(() => {});
}
