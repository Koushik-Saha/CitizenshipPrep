import { countriesWithQuestions } from '@oathly/api/countries';
import { listCountryFacts } from '@oathly/api/server';

import { loadPublic } from '@/lib/public-content';

// GET /api/public/countries: the exams Oathly covers, for the mobile app's
// welcome screen: the ones with questions to practise. No sign-in needed;
// nothing here is about a learner.
// Cached like the public pages and refreshed by the publish webhook.
export const revalidate = 3600;

export async function GET() {
  const countries = await loadPublic((db) => listCountryFacts(db), []);
  return Response.json(countriesWithQuestions(countries));
}
