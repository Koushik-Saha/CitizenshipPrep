import { getMe } from '@oathly/api/server';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const me = await getMe(getDb(), userId);
  return me ? Response.json(me) : jsonError('Sign in to continue.', 401);
}
