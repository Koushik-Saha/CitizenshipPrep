import { recordAnswers } from '@oathly/api/server';
import type { QueuedAnswer } from '@oathly/core';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

const MAX_BATCH = 100;

// Receives answers from a client's offline queue (see packages/core
// offline-queue). Re-sending is safe; the response says which were stored.
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const body = (await request.json().catch(() => null)) as { answers?: unknown } | null;
  if (!body || !Array.isArray(body.answers)) return jsonError('Send { "answers": [...] }.', 400);
  if (body.answers.length > MAX_BATCH)
    return jsonError(`Send at most ${MAX_BATCH} answers at a time.`, 413);
  return Response.json(await recordAnswers(getDb(), userId, body.answers as QueuedAnswer[]));
}
