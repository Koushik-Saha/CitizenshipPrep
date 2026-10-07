import { timingSafeEqual } from 'node:crypto';

import { parseCountryCode } from '@oathly/api/country-search';
import { listTestPages } from '@oathly/api/server';

import { getDb } from '@/lib/db';
import { revalidatePublicContent } from '@/lib/revalidate';

// POST /api/revalidate  (Authorization: Bearer <REVALIDATE_SECRET>)
// Body, optional: {"country": "US"} to refresh one country's pages only.
//
// The publish webhook: the content CLI calls it after changing countries or
// exam formats, and anything else that publishes content can too. The admin
// review screens revalidate directly, without going through HTTP.

const MIN_SECRET_LENGTH = 32;

function authorized(request: Request): boolean {
  const secret = process.env.REVALIDATE_SECRET ?? '';
  if (secret.length < MIN_SECRET_LENGTH) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: 'Not authorized.' }, { status: 401 });
  }
  let country: string | null = null;
  const body = await request.text();
  if (body.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return Response.json({ error: 'Body must be JSON.' }, { status: 400 });
    }
    const value = (parsed as { country?: unknown } | null)?.country;
    if (value !== undefined) {
      country = parseCountryCode(value);
      if (!country) {
        return Response.json({ error: 'country must be a two-letter code.' }, { status: 400 });
      }
    }
  }
  // The pages are addressed by the country's slug. A code Oathly has no
  // country for refreshes everything, as no code does.
  const slug = country
    ? (await listTestPages(getDb())).find((page) => page.isoCode === country)?.slug
    : undefined;
  return Response.json({ revalidated: revalidatePublicContent(slug) });
}
