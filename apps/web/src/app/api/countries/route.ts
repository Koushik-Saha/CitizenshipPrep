import { listExamCountries } from '@oathly/api/server';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  if (!(await apiUserId(request))) return jsonError('Sign in to continue.', 401);
  return Response.json(await listExamCountries(getDb()));
}
