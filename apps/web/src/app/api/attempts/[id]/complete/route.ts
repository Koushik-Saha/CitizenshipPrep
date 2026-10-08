import { idSchema, sessionResultSchema } from '@oathly/api/schemas';
import { completeAttempt, StudyError } from '@oathly/api/server';
import { platformOf } from '@oathly/core';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { track } from '@/lib/analytics';
import { getDb } from '@/lib/db';
import { readJson } from '@/lib/http';

export async function POST(
  request: Request,
  { params }: RouteContext<'/api/attempts/[id]/complete'>,
) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const attemptId = idSchema.safeParse((await params).id);
  if (!attemptId.success) return jsonError('Unknown session.', 404);
  const { data: result, problem } = await readJson(
    request,
    sessionResultSchema,
    'Send { "correct", "total", "passed" }.',
  );
  if (problem) return problem;
  try {
    const { mockExam } = await completeAttempt(getDb(), userId, attemptId.data, result);
    if (mockExam) {
      track(userId, 'mock_exam_completed', {
        country: mockExam.countryCode,
        passed: result.passed,
        correct: result.correct,
        total: result.total,
        platform: platformOf(request.headers.get('authorization')),
      });
    }
  } catch (error) {
    if (error instanceof StudyError) return jsonError(error.message, 400);
    throw error;
  }
  return new Response(null, { status: 204 });
}
