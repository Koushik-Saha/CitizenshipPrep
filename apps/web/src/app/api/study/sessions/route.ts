import { startSessionRequestSchema } from '@oathly/api/schemas';
import { startSession, StudyError } from '@oathly/api/server';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

// POST /api/study/sessions: picks the questions (with the quiz engine) and
// returns the new attempt's id; GET /api/study/sessions/<id> loads it.
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const parsed = startSessionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('That is not a session this app can start.', 400);
  try {
    return Response.json({ attemptId: await startSession(getDb(), userId, parsed.data) });
  } catch (error) {
    if (error instanceof StudyError) return jsonError(error.message, 400);
    throw error;
  }
}
