import { exportAccountData } from '@oathly/api/server';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';
import { rateLimited } from '@/lib/rate-limit';

// GET /api/me/export: a copy of everything held about the signed-in learner,
// as one JSON file. Theirs only: the account is the one the session names,
// never one named in the request.
export async function GET(request: Request) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const limited = await rateLimited('accountExport', 'user', userId);
  if (limited) return limited;
  const copy = await exportAccountData(getDb(), userId);
  if (!copy) return jsonError('Sign in to continue.', 401);
  return new Response(JSON.stringify(copy, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="oathly-data-${copy.exportedAt.slice(0, 10)}.json"`,
      'cache-control': 'private, no-store',
    },
  });
}
