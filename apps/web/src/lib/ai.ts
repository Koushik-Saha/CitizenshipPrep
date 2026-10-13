import {
  createAppGenerator,
  isAiConfigured as hasModelKey,
  type TextGenerator,
  type UsageOptions,
} from '@oathly/api/server';
import { isSwitchedOn } from '@oathly/core';

import { reportError } from './monitoring';
import { addressOf, rateLimited } from './rate-limit';

// The models are only ever called from here: route handlers on the server.
// Their API keys never reach a browser or the app.
const globalForAi = globalThis as typeof globalThis & { oathlyGenerator?: TextGenerator };

/**
 * Claude, with Gemini behind it when GEMINI_API_KEY is set: if Claude cannot
 * start an answer, Gemini is asked the same thing. Whoever runs the service
 * is told each time a model fails.
 */
export function getGenerator(): TextGenerator {
  globalForAi.oathlyGenerator ??= createAppGenerator(process.env, {
    onFailure(model, error) {
      reportError(error, { where: 'ai-model', model });
    },
  });
  return globalForAi.oathlyGenerator;
}

/** Whether any model has a key. Without one, AI help answers "not available". */
export function isAiConfigured(): boolean {
  return hasModelKey(process.env);
}

/** The message when a plan's allowance is used up. Relative, so it reads right in any time zone. */
export function limitMessage(resetsAt: Date | null, what: string, now: Date = new Date()): string {
  if (!resetsAt) return `You have used today’s ${what}.`;
  const minutes = Math.max(1, Math.ceil((resetsAt.getTime() - now.getTime()) / 60_000));
  const wait =
    minutes < 60
      ? `${minutes} minute${minutes === 1 ? '' : 's'}`
      : `about ${Math.round(minutes / 60)} hour${Math.round(minutes / 60) === 1 ? '' : 's'}`;
  return `You have used today’s ${what}. More will be available in ${wait}.`;
}

/**
 * The switches that turn an AI feature off without a release: set
 * DISABLE_AI_TUTOR or DISABLE_AI_EXPLANATIONS to "1" on the host and redeploy.
 * DISABLE_AI turns both off.
 */
export function isAiSwitchedOff(feature: 'tutor' | 'explanation'): boolean {
  return (
    isSwitchedOn(process.env.DISABLE_AI) ||
    isSwitchedOn(
      feature === 'tutor' ? process.env.DISABLE_AI_TUTOR : process.env.DISABLE_AI_EXPLANATIONS,
    )
  );
}

/** What a learner is told when AI help is switched off or the service has used its day. */
export function aiPaused(): Response {
  const message = 'AI help is paused for now. Please try again later.';
  return Response.json(
    { error: message, message, code: 'AI_PAUSED' },
    { status: 503, headers: { 'cache-control': 'no-store' } },
  );
}

/**
 * What a learner is told when no model could start an answer: the provider is
 * out of credit, down, or not set up. Nothing was counted against them.
 */
export function aiUnavailable(): Response {
  const message =
    'AI help is not available right now. You can keep studying: every question still has its written explanation. Please try again later.';
  return Response.json(
    { error: message, message, code: 'AI_UNAVAILABLE' },
    { status: 503, headers: { 'cache-control': 'no-store' } },
  );
}

/**
 * The checks every AI request passes before anything else is done with it:
 * the feature's switch, the caller's burst limit, and a limit per network
 * address. A response means stop and send it. If the limits cannot be counted
 * the request is refused: each one that gets through costs money.
 */
export async function aiGate(
  request: Request,
  feature: 'tutor' | 'explanation',
  userId: string,
): Promise<Response | null> {
  if (isAiSwitchedOff(feature)) return aiPaused();
  return (
    (await rateLimited(feature === 'tutor' ? 'tutor' : 'explain', 'user', userId, {
      failClosed: true,
    })) ?? (await rateLimited('aiByAddress', 'address', addressOf(request), { failClosed: true }))
  );
}

/** Tells whoever runs the service when the day's AI budget reaches 80% and 100%. */
export const aiUsageOptions: UsageOptions = {
  onBudgetAlert(share, usedToday, limit) {
    reportError(
      new Error(
        `AI use has reached ${share}% of the daily limit (${usedToday} of ${limit} requests).`,
      ),
      { where: 'ai-budget', share: String(share) },
    );
  },
};
