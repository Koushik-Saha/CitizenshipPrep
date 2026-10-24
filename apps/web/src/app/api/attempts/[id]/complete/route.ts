import { idSchema, sessionResultSchema } from '@oathly/api/schemas';
import { completeAttempt } from '@oathly/api/server';
import { platformOf } from '@oathly/core';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { track } from '@/lib/analytics';
import { getDb } from '@/lib/db';
import { readJson } from '@/lib/http';

// POST /api/attempts/:id/complete
// Ends a session. Clients still send the score they showed; it is not used.
// The server scores the session from the answers it has stored, so a score
// cannot be claimed (see gradeAttempt).
export async function POST(
  request: Request,
  { params }: RouteContext<'/api/attempts/[id]/complete'>,
) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const attemptId = idSchema.safeParse((await params).id);
  if (!attemptId.success) return jsonError('Unknown session.', 404);
  // A malformed request is still refused, before anything is done with it.
  const { problem } = await readJson(
    request,
    sessionResultSchema,
    'Send { "correct", "total", "passed" }.',
  );
  if (problem) return problem;
  const { mockExam } = await completeAttempt(getDb(), userId, attemptId.data);
  if (mockExam) {
    track(userId, 'mock_exam_completed', {
      country: mockExam.countryCode,
      passed: mockExam.passed,
      correct: mockExam.correct,
      total: mockExam.total,
      platform: platformOf(request.headers.get('authorization')),
    });
  }
  return new Response(null, { status: 204 });
}
