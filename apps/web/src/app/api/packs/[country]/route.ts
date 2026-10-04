import { parseCountryCode } from '@oathly/api/country-search';
import { getCountryPack, StudyError } from '@oathly/api/server';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

// GET /api/packs/<country>: everything needed to study one country with no
// connection. Published questions only.
export async function GET(request: Request, { params }: RouteContext<'/api/packs/[country]'>) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const country = parseCountryCode((await params).country);
  if (!country) return jsonError('Unknown country.', 404);
  try {
    return Response.json(await getCountryPack(getDb(), userId, country), {
      headers: { 'cache-control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof StudyError) return jsonError(error.message, 400);
    throw error;
  }
}
