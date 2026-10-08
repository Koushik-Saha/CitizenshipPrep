import { timeZoneRequestSchema } from '@oathly/api/schemas';
import { setTimeZone } from '@oathly/api/server';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';
import { readJson } from '@/lib/http';

export async function POST(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const { data, problem } = await readJson(
    request,
    timeZoneRequestSchema,
    'Send { "timeZone": "Area/City" }.',
  );
  if (problem) return problem;
  await setTimeZone(getDb(), userId, data.timeZone);
  return new Response(null, { status: 204 });
}
