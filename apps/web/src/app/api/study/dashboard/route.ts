import { getDashboard } from '@oathly/api/server';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

// GET /api/study/dashboard: the learner's streak, goal, and each country's
// readiness. Read by the mobile app and by the web dashboard's cache.
export async function GET(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const dashboard = await getDashboard(getDb(), userId);
  if (!dashboard) return jsonError('Finish setting up your study first.', 409);
  return Response.json(dashboard, { headers: { 'cache-control': 'private, no-store' } });
}
