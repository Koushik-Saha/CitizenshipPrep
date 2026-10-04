import { offlineAttemptsSchema } from '@oathly/api/schemas';
import { registerOfflineAttempts, StudyError } from '@oathly/api/server';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

// POST /api/study/sessions/offline: sessions a phone started without a
// connection, sent once it is back online and before their answers.
export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const parsed = offlineAttemptsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Send { "attempts": [...] }.', 400);
  try {
    await registerOfflineAttempts(getDb(), userId, parsed.data.attempts);
  } catch (error) {
    if (error instanceof StudyError) return jsonError(error.message, 400);
    throw error;
  }
  return new Response(null, { status: 204 });
}
