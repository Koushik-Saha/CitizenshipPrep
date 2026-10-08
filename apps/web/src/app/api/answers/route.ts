import { answersRequestSchema } from '@oathly/api/schemas';
import { recordAnswersNotingFirst } from '@oathly/api/server';
import { platformOf } from '@oathly/core';

import { track } from '@/lib/analytics';
import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';
import { readJson } from '@/lib/http';

// Receives answers from a client's offline queue (see packages/core
// offline-queue). Re-sending is safe; the response says which were stored.
// The batch is checked here; each answer is then checked on its own, so one
// bad answer is refused without holding up the rest.
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const { data, problem } = await readJson(
    request,
    answersRequestSchema,
    'Send { "answers": [...] }, at most 100 at a time.',
  );
  if (problem) return problem;
  const { outcome, firstAnswer } = await recordAnswersNotingFirst(getDb(), userId, data.answers);
  if (firstAnswer) {
    track(userId, 'first_question_answered', {
      country: firstAnswer.countryCode,
      platform: platformOf(request.headers.get('authorization')),
    });
  }
  return Response.json(outcome);
}
