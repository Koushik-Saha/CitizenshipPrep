import { describe, expect, it } from 'vitest';

import {
  applySyncFailure,
  applySyncOutcome,
  emptyQueue,
  enqueue,
  MAX_ATTEMPTS,
  nextSyncAt,
  parseQueue,
  readyBatch,
  retryDelay,
  serializeQueue,
  syncQueue,
  type OfflineQueue,
  type QueuedAnswer,
} from './offline-queue';

const answer = (id: string): QueuedAnswer => ({
  clientEventId: id,
  attemptId: 'attempt-1',
  questionId: `question-${id}`,
  questionVersion: 1,
  selectedKeys: ['a'],
  correct: true,
  timeMs: 4_000,
  answeredAt: '2026-10-03T10:00:00.000Z',
});

const T = 1_000_000;
const queueOf = (...ids: string[]): OfflineQueue =>
  ids.reduce((queue, id) => enqueue(queue, answer(id), T), emptyQueue());

describe('enqueue', () => {
  it('adds answers in order, ready to send now', () => {
    const queue = queueOf('a', 'b');
    expect(queue.pending.map((entry) => entry.answer.clientEventId)).toEqual(['a', 'b']);
    expect(queue.pending[0]).toEqual({
      answer: answer('a'),
      attempts: 0,
      nextAttemptAt: T,
      lastError: null,
    });
  });

  it('ignores an answer it already holds, pending or dead', () => {
    const queue = queueOf('a');
    expect(enqueue(queue, answer('a'), T + 1)).toBe(queue);
    const dead = applySyncOutcome(
      queue,
      ['a'],
      { accepted: [], rejected: [{ clientEventId: 'a', reason: 'Bad', permanent: true }] },
      T,
    );
    expect(enqueue(dead, answer('a'), T)).toBe(dead);
  });
});

describe('readyBatch and nextSyncAt', () => {
  it('sends the oldest ready answers, at most `max`', () => {
    const queue = queueOf('a', 'b', 'c');
    expect(readyBatch(queue, T, 2).map((a) => a.clientEventId)).toEqual(['a', 'b']);
    expect(readyBatch(queue, T - 1, 10)).toEqual([]);
  });

  it('knows when the next send is possible', () => {
    expect(nextSyncAt(emptyQueue())).toBeNull();
    const backedOff = applySyncFailure(queueOf('a', 'b'), ['a'], 'Offline', T);
    expect(nextSyncAt(backedOff)).toBe(T);
    expect(nextSyncAt(applySyncFailure(backedOff, ['b'], 'Offline', T))).toBe(T + 5_000);
  });
});

describe('retryDelay', () => {
  it('doubles from 5 seconds and stops at an hour', () => {
    expect([1, 2, 3].map(retryDelay)).toEqual([5_000, 10_000, 20_000]);
    expect(retryDelay(30)).toBe(60 * 60 * 1000);
  });
});

describe('applySyncOutcome', () => {
  it('drops accepted answers and leaves unsent ones untouched', () => {
    const queue = applySyncOutcome(
      queueOf('a', 'b', 'c'),
      ['a', 'b'],
      { accepted: ['a', 'b'], rejected: [] },
      T,
    );
    expect(queue.pending.map((entry) => entry.answer.clientEventId)).toEqual(['c']);
    expect(queue.pending[0]!.attempts).toBe(0);
  });

  it('retries a temporary refusal later, and gives up on a permanent one', () => {
    const queue = applySyncOutcome(
      queueOf('a', 'b'),
      ['a', 'b'],
      {
        accepted: [],
        rejected: [
          { clientEventId: 'a', reason: 'Busy', permanent: false },
          { clientEventId: 'b', reason: 'Unknown question', permanent: true },
        ],
      },
      T,
    );
    expect(queue.pending).toEqual([
      { answer: answer('a'), attempts: 1, nextAttemptAt: T + 5_000, lastError: 'Busy' },
    ]);
    expect(queue.deadLetter).toEqual([
      { answer: answer('b'), attempts: 1, nextAttemptAt: T + 5_000, lastError: 'Unknown question' },
    ]);
  });

  it('retries an answer the server neither accepted nor refused', () => {
    const queue = applySyncOutcome(queueOf('a'), ['a'], { accepted: [], rejected: [] }, T);
    expect(queue.pending[0]!.lastError).toBe('The server did not confirm this answer.');
  });

  it('gives up after the last attempt', () => {
    let queue = queueOf('a');
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) queue = applySyncFailure(queue, ['a'], 'Offline', T);
    expect(queue.pending).toEqual([]);
    expect(queue.deadLetter[0]).toMatchObject({ attempts: MAX_ATTEMPTS, lastError: 'Offline' });
  });
});

describe('syncQueue', () => {
  it('does nothing when nothing is ready', async () => {
    const queue = emptyQueue();
    await expect(
      syncQueue(
        queue,
        async () => {
          throw new Error('should not be called');
        },
        T,
      ),
    ).resolves.toBe(queue);
  });

  it('sends a batch and applies the result', async () => {
    const sent: string[][] = [];
    const queue = await syncQueue(
      queueOf('a', 'b', 'c'),
      async (batch) => {
        sent.push(batch.map((a) => a.clientEventId));
        return { accepted: batch.map((a) => a.clientEventId), rejected: [] };
      },
      T,
      2,
    );
    expect(sent).toEqual([['a', 'b']]);
    expect(queue.pending.map((entry) => entry.answer.clientEventId)).toEqual(['c']);
  });

  it('turns a failed send into a retry, whatever was thrown', async () => {
    const afterError = await syncQueue(
      queueOf('a'),
      async () => {
        throw new Error('Network down');
      },
      T,
    );
    expect(afterError.pending[0]).toMatchObject({ attempts: 1, lastError: 'Network down' });
    const afterString = await syncQueue(queueOf('a'), () => Promise.reject('timeout'), T);
    expect(afterString.pending[0]).toMatchObject({ attempts: 1, lastError: 'timeout' });
  });
});

describe('serializeQueue and parseQueue', () => {
  it('round-trips a queue', () => {
    const queue = applySyncFailure(queueOf('a', 'b'), ['a'], 'Offline', T);
    expect(parseQueue(serializeQueue(queue))).toEqual(queue);
  });

  it('starts fresh from anything missing, corrupt, outdated or malformed', () => {
    expect(parseQueue(null)).toEqual(emptyQueue());
    expect(parseQueue('{not json')).toEqual(emptyQueue());
    expect(parseQueue(JSON.stringify({ version: 0, pending: [], deadLetter: [] }))).toEqual(
      emptyQueue(),
    );
    expect(
      parseQueue(JSON.stringify({ version: 1, pending: [{ nope: true }], deadLetter: [] })),
    ).toEqual(emptyQueue());
  });
});
