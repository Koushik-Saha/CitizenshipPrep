import { hasOptedOutOfAnalytics } from '@oathly/api/server';
import type { AnalyticsEventName, AnalyticsEvents } from '@oathly/core';
import { after } from 'next/server';
import { PostHog } from 'posthog-node';

import { getDb } from './db';

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

// Whether each learner has asked not to be counted, remembered for a few
// minutes so that counting an event does not mean asking the database first.
const CHOICE_TTL_MS = 5 * 60 * 1000;
const choices = new Map<string, { optedOut: boolean; at: number }>();

async function optedOut(userId: string): Promise<boolean> {
  const known = choices.get(userId);
  if (known && Date.now() - known.at < CHOICE_TTL_MS) return known.optedOut;
  // If the choice cannot be read, the event is not sent: not counting someone
  // who allowed it loses a number; counting someone who refused breaks a promise.
  const answer = await hasOptedOutOfAnalytics(getDb(), userId).catch(() => true);
  if (choices.size > 5000) choices.clear();
  choices.set(userId, { optedOut: answer, at: Date.now() });
  return answer;
}

/** Called when a learner changes their choice, so the next event follows the new one. */
export function forgetAnalyticsChoice(userId: string): void {
  choices.delete(userId);
}

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
  // Nothing is sent for a learner who has asked not to be counted.
  const send = async () => {
    if (await optedOut(userId)) return;
    posthog.capture({ distinctId: userId, event, properties });
    await posthog.flush().catch(() => {});
  };
  try {
    after(() => send().catch(() => {}));
  } catch {
    // Outside a request (a script, a test) there is no "after": send now,
    // and an event lost here is only a count.
    void send().catch(() => {});
  }
}
