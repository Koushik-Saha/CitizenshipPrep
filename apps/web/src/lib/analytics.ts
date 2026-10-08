import type { AnalyticsEventName, AnalyticsEvents } from '@oathly/core';
import { after } from 'next/server';
import { PostHog } from 'posthog-node';

// Product analytics (PostHog), sent from the server: the key events all pass
// through it, whichever app the learner is on, and nothing is added to what
// the browser or the phone downloads. A learner is known only by their
// account id. Switched on by POSTHOG_KEY; without it nothing is sent.

const globalForAnalytics = globalThis as typeof globalThis & { oathlyPostHog?: PostHog | null };

function client(): PostHog | null {
  if (globalForAnalytics.oathlyPostHog === undefined) {
    const key = process.env.POSTHOG_KEY;
    globalForAnalytics.oathlyPostHog = key
      ? new PostHog(key, {
          host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
          // A serverless function may stop as soon as it has answered: send
          // each event rather than waiting to fill a batch.
          flushAt: 1,
          flushInterval: 0,
        })
      : null;
  }
  return globalForAnalytics.oathlyPostHog;
}

export const isAnalyticsConfigured = () => Boolean(process.env.POSTHOG_KEY);

/**
 * Counts a key event for a learner. Sent after the response, so it never
 * slows one down, and a failure to send never fails a request.
 */
export function track<Name extends AnalyticsEventName>(
  userId: string,
  event: Name,
  properties: AnalyticsEvents[Name],
): void {
  const posthog = client();
  if (!posthog) return;
  try {
    posthog.capture({ distinctId: userId, event, properties });
    after(() => posthog.flush().catch(() => {}));
  } catch {
    // Outside a request (a script, a test) there is no "after": the client
    // sends on its own, and an event lost here is only a count.
  }
}
