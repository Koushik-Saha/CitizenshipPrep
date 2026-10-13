import { getDb } from '@/lib/db';
import { reportError } from '@/lib/monitoring';

// GET /api/health: whether the site and its database are answering, for an
// uptime monitor to ask every minute or so. It says "ok" or it does not, and
// nothing else: no versions, no names, nothing about what is behind it.
export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'cache-control': 'no-store' };
  try {
    await getDb().query('select 1');
    return Response.json({ status: 'ok' }, { headers });
  } catch (error) {
    reportError(error, { where: 'health' });
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
