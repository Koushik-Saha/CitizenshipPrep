import { idSchema } from '@oathly/api/schemas';
import { loadStudySession } from '@oathly/api/server';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

// GET /api/study/sessions/<id>: the whole session in one response, so the
// client can run it with no further requests.
export async function GET(request: Request, { params }: RouteContext<'/api/study/sessions/[id]'>) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return jsonError('No such session.', 404);
  const session = await loadStudySession(getDb(), userId, id.data);
  if (!session || session.questions.length === 0) return jsonError('No such session.', 404);
  return Response.json(session, { headers: { 'cache-control': 'private, no-store' } });
}
