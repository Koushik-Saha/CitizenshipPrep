import { nextStep } from '@oathly/api';
import { parseCountryCode } from '@oathly/api/countries';
import { redirect } from 'next/navigation';

import { requireMe } from '@/lib/user';

// Where sign-in lands: sends the learner to onboarding or straight to study.
// A country picked on the landing page comes along as ?country=, and is
// preselected in onboarding unless the learner already studies it.
export default async function Welcome({ searchParams }: PageProps<'/welcome'>) {
  const { me } = await requireMe();
  const country = parseCountryCode((await searchParams).country);
  const studying = me.studyCountries.some((study) => study.countryCode === country);
  if (nextStep(me) === 'study') {
    redirect(country && !studying ? `/onboarding?add=1&country=${country}` : '/study');
  }
  redirect(country ? `/onboarding?country=${country}` : '/onboarding');
}
