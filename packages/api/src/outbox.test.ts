import { emptyQueue, enqueue, type QueuedAnswer } from '@oathly/core';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from './client';
import {
  addOfflineAttempt,
  emptyOutbox,
  parseOutbox,
  recordResult,
  serializeOutbox,
  syncAll,
  waitingCount,
} from './outbox';
import type { OfflineAttempt } from './pack';

const attempt = (n: number, overrides: Partial<OfflineAttempt> = {}): OfflineAttempt => ({
  attemptId: `0ff11e00-0000-4000-8000-00000000000${n}`,
  countryCode: 'ZZ',
  mode: 'practice',
  questionIds: ['0e5710a0-0000-4000-8000-000000000001', '0e5710a0-0000-4000-8000-000000000002'],
  examFormatId: null,
  examQuestionIds: null,
  startedAt: '2026-10-03T10:00:00.000Z',
  result: null,
  ...overrides,
});
const result = { correct: 1, total: 2, passed: null };

const answer = (n: number, attemptId: string): QueuedAnswer => ({
  clientEventId: `e${n}`,
  attemptId,
  questionId: `q${n}`,
  questionVersion: 1,
  selectedKeys: ['a'],
  correct: true,
  timeMs: 1000,
  answeredAt: '2026-10-03T10:00:05.000Z',
});

const NOW = Date.parse('2026-10-03T11:00:00Z');

function fakeApi() {
  const calls: string[] = [];
  return {
    calls,
    registerOfflineAttempts: vi.fn(async (attempts: OfflineAttempt[]) => {
      calls.push(`register ${attempts.map((a) => a.attemptId.slice(-1)).join(',')}`);
    }),
    completeSession: vi.fn(async (attemptId: string) => {
      calls.push(`complete ${attemptId}`);
    }),
    sendAnswers: vi.fn(async (answers: QueuedAnswer[]) => {
      calls.push(`answers ${answers.length}`);
      return { accepted: answers.map((a) => a.clientEventId), rejected: [] };
    }),
  };
}

describe('outbox state', () => {
  it('remembers an offline session once, and its result once', () => {
    let outbox = addOfflineAttempt(emptyOutbox(), attempt(1));
    outbox = addOfflineAttempt(outbox, attempt(1));
    expect(outbox.attempts).toHaveLength(1);

    outbox = recordResult(outbox, attempt(1).attemptId, result);
    outbox = recordResult(outbox, attempt(1).attemptId, { correct: 0, total: 2, passed: null });
    expect(outbox.attempts[0]!.result).toEqual(result);
    expect(outbox.completions).toEqual([]);
  });

  it('queues the result of a session the server created', () => {
    let outbox = recordResult(emptyOutbox(), 'server-attempt', result);
    outbox = recordResult(outbox, 'server-attempt', { correct: 0, total: 2, passed: null });
    expect(outbox.completions).toEqual([{ attemptId: 'server-attempt', result }]);
  });

  it('survives storage, and starts empty from anything unreadable', () => {
    const outbox = recordResult(
      addOfflineAttempt(emptyOutbox(), attempt(1, { result })),
      'server-attempt',
      result,
    );
    expect(parseOutbox(serializeOutbox(outbox))).toEqual(outbox);
    expect(parseOutbox(null)).toEqual(emptyOutbox());
    expect(parseOutbox('{not json')).toEqual(emptyOutbox());
    expect(parseOutbox('{"version":99}')).toEqual(emptyOutbox());
  });

  it('counts what is waiting: answers, results, and finished offline sessions', () => {
    const outbox = recordResult(
      addOfflineAttempt(addOfflineAttempt(emptyOutbox(), attempt(1, { result })), attempt(2)),
      'server-attempt',
      result,
    );
    const queue = enqueue(emptyQueue(), answer(1, 'a'), NOW);
    expect(waitingCount(outbox, queue)).toBe(3);
    expect(waitingCount(emptyOutbox(), emptyQueue())).toBe(0);
  });
});

describe('syncAll', () => {
  it('sends sessions, then results, then answers, and clears what was sent', async () => {
    const api = fakeApi();
    const outbox = recordResult(
      addOfflineAttempt(addOfflineAttempt(emptyOutbox(), attempt(1, { result })), attempt(2)),
      'server-attempt',
      result,
    );
    const queue = enqueue(emptyQueue(), answer(1, attempt(1).attemptId), NOW);
    const synced = await syncAll(api, outbox, queue, NOW);
    expect(api.calls).toEqual(['register 1', 'register 2', 'complete server-attempt', 'answers 1']);
    // The session still in progress stays, to be sent again with its result.
    expect(synced.outbox).toEqual({ attempts: [attempt(2)], completions: [] });
    expect(synced.queue.pending).toEqual([]);
    expect(synced.stoppedBy).toBeNull();
  });

  it('stops when offline and keeps everything, without sending answers ahead of their sessions', async () => {
    const api = fakeApi();
    api.registerOfflineAttempts.mockRejectedValue(new TypeError('Network request failed'));
    const outbox = addOfflineAttempt(emptyOutbox(), attempt(1, { result }));
    const queue = enqueue(emptyQueue(), answer(1, attempt(1).attemptId), NOW);
    const synced = await syncAll(api, outbox, queue, NOW);
    expect(synced).toEqual({ outbox, queue, stoppedBy: 'Network request failed' });
    expect(api.sendAnswers).not.toHaveBeenCalled();

    const signedOut = fakeApi();
    signedOut.completeSession.mockRejectedValue(new ApiError('You are signed out.', 401));
    const waiting = recordResult(emptyOutbox(), 'server-attempt', result);
    expect((await syncAll(signedOut, waiting, emptyQueue(), NOW)).outbox).toEqual(waiting);
  });

  it('drops only what the server refuses for good', async () => {
    const api = fakeApi();
    api.registerOfflineAttempts.mockImplementation(async ([first]) => {
      if (first!.attemptId.endsWith('1')) throw new ApiError('Invalid question list.', 400);
    });
    api.completeSession.mockRejectedValue(new ApiError('Invalid result.', 400));
    const outbox = recordResult(
      addOfflineAttempt(
        addOfflineAttempt(emptyOutbox(), attempt(1, { result })),
        attempt(2, { result }),
      ),
      'server-attempt',
      result,
    );
    const synced = await syncAll(api, outbox, emptyQueue(), NOW);
    expect(synced.outbox).toEqual(emptyOutbox());
    expect(synced.stoppedBy).toBeNull();
  });

  it('reports answers that could not be sent, keeping them queued', async () => {
    const api = fakeApi();
    api.sendAnswers.mockRejectedValue('server down');
    api.completeSession.mockRejectedValue('weird');
    const queue = enqueue(emptyQueue(), answer(1, 'a'), NOW);
    const synced = await syncAll(api, emptyOutbox(), queue, NOW);
    expect(synced.queue.pending).toHaveLength(1);
    expect(synced.stoppedBy).toBe('server down');
    const stopped = await syncAll(api, recordResult(emptyOutbox(), 'x', result), queue, NOW);
    expect(stopped.stoppedBy).toBe('weird');
  });
});
