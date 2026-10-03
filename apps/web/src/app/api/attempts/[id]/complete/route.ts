import { completeAttempt, StudyError } from '@oathly/api/server';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: RouteContext<'/api/attempts/[id]/complete'>,
) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const body = (await request.json().catch(() => null)) as {
    correct?: number;
    total?: number;
    passed?: boolean | null;
  } | null;
  try {
    await completeAttempt(getDb(), userId, (await params).id, {
      correct: Number(body?.correct),
      total: Number(body?.total),
      passed: typeof body?.passed === 'boolean' ? body.passed : null,
    });
  } catch (error) {
    if (error instanceof StudyError) return jsonError(error.message, 400);
    throw error;
  }
  return new Response(null, { status: 204 });
}
