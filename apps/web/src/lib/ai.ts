import { createClaudeGenerator, type TextGenerator } from '@oathly/api/server';

// Claude is only ever called from here: route handlers on the server. The API
// key never reaches a browser or the app.
const globalForAi = globalThis as typeof globalThis & { oathlyGenerator?: TextGenerator };

export function getGenerator(): TextGenerator {
  globalForAi.oathlyGenerator ??= createClaudeGenerator();
  return globalForAi.oathlyGenerator;
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
