import { nextStep } from '@oathly/api';
import { parseCountryCode } from '@oathly/api/countries';
import { localizePath } from '@oathly/i18n';
import { redirect } from 'next/navigation';

import { getT } from '@/lib/i18n';
import { requireMe } from '@/lib/user';

// Where sign-in lands: sends the learner to onboarding or straight to study.
// A country picked on the landing page comes along as ?country=, and is
// preselected in onboarding unless the learner already studies it.
export default async function Welcome({ params, searchParams }: PageProps<'/[locale]/welcome'>) {
  const { locale } = await getT(params);
  const { me } = await requireMe(locale);
  const to = (path: string) => localizePath(locale, path);
  const country = parseCountryCode((await searchParams).country);
  const studying = me.studyCountries.some((study) => study.countryCode === country);
  if (nextStep(me) === 'study') {
    redirect(to(country && !studying ? `/onboarding?add=1&country=${country}` : '/study'));
  }
  redirect(to(country ? `/onboarding?country=${country}` : '/onboarding'));
}
