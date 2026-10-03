import { explain } from '@oathly/api/server';

import { getGenerator, limitMessage } from '@/lib/ai';
import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

// POST { questionId } -> the explanation as plain text, streamed when it is
// being written and sent whole when it is cached.
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const body = (await request.json().catch(() => null)) as { questionId?: unknown } | null;
  if (typeof body?.questionId !== 'string') return jsonError('Send { "questionId": "..." }.', 400);

  const outcome = await explain(getDb(), getGenerator(), userId, body.questionId);
  const headers = { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' };
  switch (outcome.kind) {
    case 'cached':
      return new Response(outcome.text, {
        headers: {
          ...headers,
          'content-language': outcome.locale,
          'x-explanation-source': 'cache',
        },
      });
    case 'stream':
      return new Response(outcome.stream, {
        headers: {
          ...headers,
          'content-language': outcome.locale,
          'x-explanation-source': 'generated',
        },
      });
    case 'limited':
      return jsonError(limitMessage(outcome.quota.resetsAt, 'AI explanations'), 429);
    case 'unavailable':
      return jsonError('There is no source passage to explain this question from.', 404);
  }
}
