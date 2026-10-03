import { setTimeZone } from '@oathly/api/server';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const body = (await request.json().catch(() => null)) as { timeZone?: unknown } | null;
  if (typeof body?.timeZone !== 'string')
    return jsonError('Send { "timeZone": "Area/City" }.', 400);
  await setTimeZone(getDb(), userId, body.timeZone);
  return new Response(null, { status: 204 });
}
