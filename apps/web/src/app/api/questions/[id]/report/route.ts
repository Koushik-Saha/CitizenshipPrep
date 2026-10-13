import { reportQuestion } from '@oathly/api/server';
import { parseQuestionReport } from '@oathly/core';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';
import { rateLimited } from '@/lib/rate-limit';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/questions/<id>/report { reason, details?, locale? }: a learner
// says something is wrong with a question. It goes to the reviewers' queue
// (/admin/flags); the learner is told it was received, nothing more.
export async function POST(
  request: Request,
  { params }: RouteContext<'/api/questions/[id]/report'>,
) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const limited = await rateLimited('questionReport', 'user', userId);
  if (limited) return limited;

  const { id } = await params;
  const report = parseQuestionReport(await request.json().catch(() => null));
  if (!ID.test(id) || !report) {
    return jsonError(
      'Send { "reason": "incorrect" | "outdated" | "unclear" | "typo", "details"? }.',
      400,
    );
  }
  const outcome = await reportQuestion(getDb(), userId, id, report);
  if (outcome === 'missing') return jsonError('That question is not one you can report.', 404);
  // Reporting the same thing twice is not an error: it is already with a reviewer.
  return Response.json(
    { received: true },
    { status: outcome === 'saved' ? 201 : 200, headers: { 'cache-control': 'private, no-store' } },
  );
}
