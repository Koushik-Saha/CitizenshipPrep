'use client';

import {
  emptyQueue,
  enqueue,
  nextSyncAt,
  parseQueue,
  serializeQueue,
  syncQueue,
  type OfflineQueue,
  type QueuedAnswer,
  type SyncOutcome,
} from '@oathly/core';

// Saves answers in the background. Recording an answer only touches memory
// and localStorage; sending happens later, in batches, with retries, and
// survives reloads and going offline. The queue logic itself is the engine's
// (packages/core offline-queue); this file only wires it to the browser.

const STORAGE_KEY = 'oathly.answer-queue.v1';

let queue: OfflineQueue | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let sending = false;
const listeners = new Set<(pending: number) => void>();

function load(): OfflineQueue {
  if (queue) return queue;
  try {
    queue = parseQueue(localStorage.getItem(STORAGE_KEY));
  } catch {
    queue = emptyQueue();
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => schedule(0));
  }
  return queue;
}

function save(next: OfflineQueue): void {
  queue = next;
  try {
    localStorage.setItem(STORAGE_KEY, serializeQueue(next));
  } catch {
    // Storage full or blocked: the queue still lives in memory for this page.
  }
  for (const listener of listeners) listener(next.pending.length);
}

async function send(batch: QueuedAnswer[]): Promise<SyncOutcome> {
  const response = await fetch('/api/answers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ answers: batch }),
    keepalive: true,
  });
  if (!response.ok) throw new Error(`Saving answers failed (${response.status}).`);
  return (await response.json()) as SyncOutcome;
}

function schedule(delay: number): void {
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), delay);
}

async function flush(): Promise<void> {
  if (sending) return;
  sending = true;
  try {
    save(await syncQueue(load(), send, Date.now()));
  } finally {
    sending = false;
  }
  const next = nextSyncAt(load());
  if (next !== null) schedule(Math.max(0, next - Date.now()));
}

/** Records an answer and returns at once. It is sent shortly after, in the background. */
export function recordAnswer(answer: QueuedAnswer): void {
  save(enqueue(load(), answer, Date.now()));
  // Batch answers given in quick succession into one request.
  schedule(1_500);
}

/** Sends whatever is waiting now, e.g. at the end of a session. Never throws. */
export function flushAnswers(): void {
  load();
  schedule(0);
}

/** Answers not yet confirmed by the server. */
export function subscribePending(listener: (pending: number) => void): () => void {
  listeners.add(listener);
  listener(load().pending.length);
  return () => listeners.delete(listener);
}

/** Records the end of a session in the background, retrying a few times. */
export function completeSession(
  attemptId: string,
  result: { correct: number; total: number; passed: boolean | null },
): void {
  const attempt = async (tries: number): Promise<void> => {
    try {
      const response = await fetch(`/api/attempts/${attemptId}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(result),
        keepalive: true,
      });
      if (!response.ok && response.status >= 500) throw new Error(String(response.status));
    } catch {
      if (tries < 4) setTimeout(() => void attempt(tries + 1), 2_000 * 2 ** tries);
    }
  };
  void attempt(0);
}
