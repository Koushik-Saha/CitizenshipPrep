import {
  countriesWithQuestions,
  localCountryName,
  parseCountryCode,
  testPath,
  trialCountryFor,
} from '@oathly/api/countries';
import { listCountryFacts } from '@oathly/api/server';
import { TRIAL_QUESTIONS } from '@oathly/core';
import { localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { Badge, focusRing } from '@/components/ui';
import { getT } from '@/lib/i18n';
import { loadPublic } from '@/lib/public-content';

// "/try": a round of practice with no account, from anywhere on the site that
// does not know the visitor's test. It opens the trial of the country the
// visitor is in when that country has questions (the host says where the
// request came from), or of the only country there is; otherwise, and with
// "?choose", the visitor picks. "?country=US" opens that country's. Nothing is
// hard-coded: the countries are data.

export async function generateMetadata({ params }: PageProps<'/[locale]/try'>): Promise<Metadata> {
  const { t } = await getT(params);
  return {
    title: t('trial.chooseMetaTitle', { count: TRIAL_QUESTIONS }),
    description: t('trial.chooseIntro'),
    // The trials themselves are linked from each country's page.
    robots: { index: false, follow: true },
  };
}

export default async function Try({ params, searchParams }: PageProps<'/[locale]/try'>) {
  const { locale, t } = await getT(params);
  const countries = countriesWithQuestions(await loadPublic((db) => listCountryFacts(db), []));
  const query = await searchParams;
  // A country asked for by its code (the globe links here with one).
  const asked = typeof query.country === 'string' ? parseCountryCode(query.country) : null;
  const askedFor = asked ? countries.find((country) => country.isoCode === asked) : undefined;
  if (askedFor) redirect(localizePath(locale, `${testPath(askedFor.slug)}/try`));
  if (query.choose === undefined) {
    const visitorCountry = (await headers()).get('x-vercel-ip-country');
    const pick = trialCountryFor(countries, visitorCountry);
    if (pick) redirect(localizePath(locale, `${testPath(pick.slug)}/try`));
  }
  return (
    <>
      <SiteHeader t={t} path="/try" />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl font-semibold text-balance sm:text-5xl">
          {t('trial.chooseTitle', { count: TRIAL_QUESTIONS })}
        </h1>
        <p className="text-fg-muted mt-4 text-lg">{t('trial.chooseIntro')}</p>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {countries.map((country) => (
            <li key={country.isoCode}>
              <Link
                href={localizePath(locale, `${testPath(country.slug)}/try`)}
                className={`${focusRing} border-border-strong bg-surface hover:bg-surface-sunken flex min-h-11 flex-col rounded-lg border px-5 py-4`}
              >
                <span className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  {localCountryName(country, t)}
                  {!country.complete && <Badge tone="warning">{t('common.beta')}</Badge>}
                </span>
                {country.exams[0] && (
                  <span className="text-fg-muted text-sm">{country.exams[0].name}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
