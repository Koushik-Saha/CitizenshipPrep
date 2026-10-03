import { askTutor, TutorError } from '@oathly/api/server';

import { getGenerator, limitMessage } from '@/lib/ai';
import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

// POST { countryCode, messages: [{ role, content }] } -> the tutor's reply, streamed.
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const body = (await request.json().catch(() => null)) as {
    countryCode?: unknown;
    messages?: unknown;
  } | null;
  if (typeof body?.countryCode !== 'string')
    return jsonError('Send { "countryCode", "messages" }.', 400);

  let outcome;
  try {
    outcome = await askTutor(getDb(), getGenerator(), userId, {
      countryCode: body.countryCode,
      messages: body.messages,
    });
  } catch (error) {
    if (error instanceof TutorError) return jsonError(error.message, 400);
    throw error;
  }
  switch (outcome.kind) {
    case 'stream':
      return new Response(outcome.stream, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-tutor-remaining': String(outcome.quota.remaining),
        },
      });
    case 'limited':
      return jsonError(limitMessage(outcome.quota.resetsAt, 'tutor messages'), 429);
    case 'not-studying':
      return jsonError('Add this country to your study plan to ask its tutor.', 403);
  }
}
