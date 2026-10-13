import { nextStep } from '@oathly/api';
import { parsePlanChoice, plansPath } from '@oathly/api/billing';
import { parseCountryCode } from '@oathly/api/countries';
import { localizePath } from '@oathly/i18n';
import { redirect } from 'next/navigation';

import { getT } from '@/lib/i18n';
import { requireMe } from '@/lib/user';

// Where sign-in lands: sends the learner to onboarding or straight to study.
// A country picked on the landing page comes along as ?country=, and is
// preselected in onboarding unless the learner already studies it. A plan
// picked there (?plan=) leads to the plans page, after onboarding if that is
// still to do: a Country Pass is for a country the learner studies.
export default async function Welcome({ params, searchParams }: PageProps<'/[locale]/welcome'>) {
  const { locale } = await getT(params);
  const { me } = await requireMe(locale);
  const to = (path: string) => localizePath(locale, path);
  const query = await searchParams;
  const country = parseCountryCode(query.country);
  // Just joined an organization: the dashboard says so.
  const joined =
    typeof query.joined === 'string' && /^[a-z0-9-]{1,80}$/.test(query.joined)
      ? query.joined
      : null;
  const plan = parsePlanChoice(query.plan);
  const studying = me.studyCountries.some((study) => study.countryCode === country);
  if (nextStep(me) === 'study') {
    if (joined) redirect(to(`/study?joined=${joined}`));
    if (plan) redirect(to(plansPath(plan)));
    redirect(to(country && !studying ? `/onboarding?add=1&country=${country}` : '/study'));
  }
  const onward = new URLSearchParams();
  if (country) onward.set('country', country);
  if (plan) onward.set('plan', plan);
  redirect(to(onward.size > 0 ? `/onboarding?${onward}` : '/onboarding'));
}
