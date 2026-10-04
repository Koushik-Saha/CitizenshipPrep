import { listCountryFacts } from '@oathly/api/server';

import { loadPublic } from '@/lib/public-content';

// GET /api/public/countries: the exams Oathly covers, for the mobile app's
// welcome screen. No sign-in needed; nothing here is about a learner.
// Cached like the public pages and refreshed by the publish webhook.
export const revalidate = 3600;

export async function GET() {
  return Response.json(await loadPublic((db) => listCountryFacts(db), []));
}
