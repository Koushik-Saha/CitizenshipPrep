// zod/mini: this module runs in the browser, so it uses the smaller,
// tree-shakable API.
import * as z from 'zod/mini';

// A queue of answers recorded while offline (or before the server confirmed
// them), synced later. Pure state transitions: the app persists the state with
// serializeQueue() and supplies the network call to syncQueue().

/** One answer as the server stores it. clientEventId makes retries safe to repeat. */
export interface QueuedAnswer {
  clientEventId: string;
  attemptId: string;
  questionId: string;
  questionVersion: number;
  selectedKeys: string[];
  correct: boolean;
  timeMs: number;
  /** ISO 8601. */
  answeredAt: string;
}

export interface QueueEntry {
  answer: QueuedAnswer;
  /** Failed sends so far. */
  attempts: number;
  /** Epoch milliseconds; the entry is not sent before this. */
  nextAttemptAt: number;
  lastError: string | null;
}

export interface OfflineQueue {
  pending: QueueEntry[];
  /** Answers the server refused for good, kept so nothing is lost silently. */
  deadLetter: QueueEntry[];
}

export interface SyncOutcome {
  /** clientEventIds the server stored, including ones it already had. */
  accepted: string[];
  /** Answers the server refused. Permanent refusals are not retried. */
  rejected: { clientEventId: string; reason: string; permanent: boolean }[];
}

export const MAX_ATTEMPTS = 8;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60 * 60 * 1000;

export function emptyQueue(): OfflineQueue {
  return { pending: [], deadLetter: [] };
}

/** Wait before retry number `attempts`: 5s, 10s, 20s... capped at an hour. */
export function retryDelay(attempts: number): number {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempts - 1));
}

/** Adds an answer. The same clientEventId twice is ignored. */
export function enqueue(queue: OfflineQueue, answer: QueuedAnswer, now: number): OfflineQueue {
  const known = [...queue.pending, ...queue.deadLetter].some(
    (entry) => entry.answer.clientEventId === answer.clientEventId,
  );
  if (known) return queue;
  return {
    ...queue,
    pending: [...queue.pending, { answer, attempts: 0, nextAttemptAt: now, lastError: null }],
  };
}

/** The oldest answers ready to send now, at most `max`. */
export function readyBatch(queue: OfflineQueue, now: number, max: number): QueuedAnswer[] {
  return queue.pending
    .filter((entry) => entry.nextAttemptAt <= now)
    .slice(0, max)
    .map((entry) => entry.answer);
}

/** Earliest time anything can be sent, or null when the queue is empty. */
export function nextSyncAt(queue: OfflineQueue): number | null {
  if (queue.pending.length === 0) return null;
  return Math.min(...queue.pending.map((entry) => entry.nextAttemptAt));
}

/**
 * Applies the server's answer to a sent batch. Accepted entries leave the
 * queue; rejected or unacknowledged ones are retried with backoff, or moved
 * to the dead letter list when refused permanently or out of attempts.
 */
export function applySyncOutcome(
  queue: OfflineQueue,
  sent: readonly string[],
  outcome: SyncOutcome,
  now: number,
): OfflineQueue {
  const sentIds = new Set(sent);
  const accepted = new Set(outcome.accepted);
  const rejected = new Map(outcome.rejected.map((entry) => [entry.clientEventId, entry]));
  const pending: QueueEntry[] = [];
  const deadLetter = [...queue.deadLetter];

  for (const entry of queue.pending) {
    const id = entry.answer.clientEventId;
    if (!sentIds.has(id)) {
      pending.push(entry);
      continue;
    }
    if (accepted.has(id)) continue;
    const refusal = rejected.get(id);
    const attempts = entry.attempts + 1;
    const failed: QueueEntry = {
      answer: entry.answer,
      attempts,
      nextAttemptAt: now + retryDelay(attempts),
      lastError: refusal?.reason ?? 'The server did not confirm this answer.',
    };
    if (refusal?.permanent || attempts >= MAX_ATTEMPTS) deadLetter.push(failed);
    else pending.push(failed);
  }
  return { pending, deadLetter };
}

/** Records a failed send (no connection, server error): every sent entry backs off. */
export function applySyncFailure(
  queue: OfflineQueue,
  sent: readonly string[],
  error: string,
  now: number,
): OfflineQueue {
  return applySyncOutcome(
    queue,
    sent,
    {
      accepted: [],
      rejected: sent.map((clientEventId) => ({ clientEventId, reason: error, permanent: false })),
    },
    now,
  );
}

export type SendBatch = (batch: QueuedAnswer[]) => Promise<SyncOutcome>;

/** Sends one batch of ready answers and returns the updated queue. Never throws for a failed send. */
export async function syncQueue(
  queue: OfflineQueue,
  send: SendBatch,
  now: number,
  maxBatch = 50,
): Promise<OfflineQueue> {
  const batch = readyBatch(queue, now, maxBatch);
  if (batch.length === 0) return queue;
  const sent = batch.map((answer) => answer.clientEventId);
  try {
    return applySyncOutcome(queue, sent, await send(batch), now);
  } catch (error) {
    return applySyncFailure(
      queue,
      sent,
      error instanceof Error ? error.message : String(error),
      now,
    );
  }
}

const STORAGE_VERSION = 1;

const text = z.string().check(z.minLength(1));
const count = z.int().check(z.nonnegative());

const entrySchema = z.object({
  answer: z.object({
    clientEventId: text,
    attemptId: text,
    questionId: text,
    questionVersion: z.int().check(z.positive()),
    selectedKeys: z.array(z.string()),
    correct: z.boolean(),
    timeMs: z.number().check(z.nonnegative()),
    answeredAt: text,
  }),
  attempts: count,
  nextAttemptAt: z.number(),
  lastError: z.nullable(z.string()),
});

const storedQueueSchema = z.object({
  version: z.literal(STORAGE_VERSION),
  pending: z.array(entrySchema),
  deadLetter: z.array(entrySchema),
});

export function serializeQueue(queue: OfflineQueue): string {
  return JSON.stringify({ version: STORAGE_VERSION, ...queue });
}

/** Reads a stored queue. Anything unreadable starts a fresh queue rather than crashing the app. */
export function parseQueue(stored: string | null): OfflineQueue {
  if (!stored) return emptyQueue();
  let value: unknown;
  try {
    value = JSON.parse(stored);
  } catch {
    return emptyQueue();
  }
  const parsed = storedQueueSchema.safeParse(value);
  return parsed.success
    ? { pending: parsed.data.pending, deadLetter: parsed.data.deadLetter }
    : emptyQueue();
}
