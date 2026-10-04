import { syncQueue, type OfflineQueue } from '@oathly/core';
import * as z from 'zod/mini';

import { ApiError, type OathlyApi } from './client';
import type { OfflineAttempt } from './pack';
import { offlineAttemptsSchema, sessionResultSchema } from './schemas';
import type { SessionResult } from './study';

// What a phone still owes the server after studying offline, besides the
// answers themselves (those are in the engine's offline queue): sessions it
// started with no connection, and results of sessions that finished without
// one. Pure state plus one function that sends everything in a safe order.

export interface Outbox {
  /** Sessions started on the device. Kept until sent together with their result. */
  attempts: OfflineAttempt[];
  /** Results of sessions the server created, waiting to be reported. */
  completions: { attemptId: string; result: SessionResult }[];
}

export const emptyOutbox = (): Outbox => ({ attempts: [], completions: [] });

const STORAGE_VERSION = 1;
const storedSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  attempts: offlineAttemptsSchema.shape.attempts,
  completions: z.array(z.object({ attemptId: z.string(), result: sessionResultSchema })),
});

export function serializeOutbox(outbox: Outbox): string {
  return JSON.stringify({ version: STORAGE_VERSION, ...outbox });
}

/** Reads a stored outbox. Anything unreadable starts an empty one rather than crashing the app. */
export function parseOutbox(stored: string | null): Outbox {
  if (!stored) return emptyOutbox();
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return emptyOutbox();
  }
  const parsed = storedSchema.safeParse(value);
  return parsed.success
    ? { attempts: parsed.data.attempts, completions: parsed.data.completions }
    : emptyOutbox();
}

/** Remembers a session that was started with no connection. */
export function addOfflineAttempt(outbox: Outbox, attempt: OfflineAttempt): Outbox {
  if (outbox.attempts.some((known) => known.attemptId === attempt.attemptId)) return outbox;
  return { ...outbox, attempts: [...outbox.attempts, attempt] };
}

/**
 * Remembers how a session ended: on its own record if it was started on the
 * device, otherwise as a result to report. The first result for a session
 * stands, as on the server.
 */
export function recordResult(outbox: Outbox, attemptId: string, result: SessionResult): Outbox {
  const local = outbox.attempts.find((attempt) => attempt.attemptId === attemptId);
  if (local) {
    if (local.result) return outbox;
    return {
      ...outbox,
      attempts: outbox.attempts.map((attempt) =>
        attempt.attemptId === attemptId ? { ...attempt, result } : attempt,
      ),
    };
  }
  if (outbox.completions.some((completion) => completion.attemptId === attemptId)) return outbox;
  return { ...outbox, completions: [...outbox.completions, { attemptId, result }] };
}

/** How many things are waiting to reach the server. */
export function waitingCount(outbox: Outbox, queue: OfflineQueue): number {
  return (
    queue.pending.length +
    outbox.completions.length +
    outbox.attempts.filter((attempt) => attempt.result !== null).length
  );
}

/** The server understood the request and said no: sending it again will not help. */
const isRefusal = (error: unknown): boolean =>
  error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401;

export interface SyncResult {
  outbox: Outbox;
  queue: OfflineQueue;
  /** Why the sync stopped early (offline, signed out, server down); null when everything was sent. */
  stoppedBy: string | null;
}

/**
 * Sends everything that is waiting, in the order the server needs: sessions
 * started on the device first (their answers refer to them), then results,
 * then the answers. Stops at the first failure that a retry might fix and
 * keeps the rest for next time; drops only what the server refuses for good.
 */
export async function syncAll(
  api: Pick<OathlyApi, 'registerOfflineAttempts' | 'completeSession' | 'sendAnswers'>,
  outbox: Outbox,
  queue: OfflineQueue,
  now: number,
): Promise<SyncResult> {
  let attempts = outbox.attempts;
  let completions = outbox.completions;
  const stop = (error: unknown): SyncResult => ({
    outbox: { attempts, completions },
    queue,
    stoppedBy: error instanceof Error ? error.message : String(error),
  });

  // One at a time, so one refused session cannot hold back the others.
  for (const attempt of outbox.attempts) {
    try {
      await api.registerOfflineAttempts([attempt]);
    } catch (error) {
      if (!isRefusal(error)) return stop(error);
      attempts = attempts.filter((kept) => kept !== attempt);
      continue;
    }
    // A finished session is done with; one still in progress stays, to be
    // sent again with its result.
    if (attempt.result) attempts = attempts.filter((kept) => kept !== attempt);
  }

  for (const completion of outbox.completions) {
    try {
      await api.completeSession(completion.attemptId, completion.result);
    } catch (error) {
      if (!isRefusal(error)) return stop(error);
    }
    completions = completions.filter((kept) => kept !== completion);
  }

  // The answer queue keeps its own retry state and never throws.
  const synced = await syncQueue(queue, (answers) => api.sendAnswers(answers), now);
  const unsent = synced.pending.find((entry) => entry.lastError);
  return {
    outbox: { attempts, completions },
    queue: synced,
    stoppedBy: unsent?.lastError ?? null,
  };
}
