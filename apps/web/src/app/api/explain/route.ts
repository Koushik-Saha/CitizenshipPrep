import { explainRequestSchema } from '@oathly/api/schemas';
import { explain } from '@oathly/api/server';

import { aiGate, aiPaused, aiUsageOptions, getGenerator, limitMessage } from '@/lib/ai';
import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';
import { readJson } from '@/lib/http';

// POST { questionId } -> the explanation as plain text, streamed when it is
// being written and sent whole when it is cached.
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  // A burst limit, on top of the plan's daily allowance.
  const limited = await aiGate(request, 'explanation', userId);
  if (limited) return limited;
  const { data, problem } = await readJson(
    request,
    explainRequestSchema,
    'Send { "questionId": "<id>" }.',
  );
  if (problem) return problem;

  const outcome = await explain(
    getDb(),
    getGenerator(),
    userId,
    data.questionId,
    new Date(),
    aiUsageOptions,
  );
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
    case 'paused':
      return aiPaused();
    case 'unavailable':
      return jsonError('There is no source passage to explain this question from.', 404);
  }
}
