import { isIsoDate } from '@oathly/core';
import { isStudyLocale, localizePath } from '@oathly/i18n';
import { parseCountryCode } from '@oathly/api/countries';
import { listCountryFacts } from '@oathly/api/server';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import { toMarkers } from '@/components/globe/markers';
import { I18nProvider } from '@/components/i18n/provider';
import { focusRing } from '@/components/ui';
import { getDb } from '@/lib/db';
import { clientMessages, getT } from '@/lib/i18n';
import { requireMe } from '@/lib/user';

import { OnboardingForm } from './onboarding-form';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/onboarding'>): Promise<Metadata> {
  return { title: (await getT(params)).t('onboarding.metaTitle') };
}

/** The browser's preferred language, if it is one Oathly offers. */
async function preferredLocale(): Promise<string | null> {
  const accepted = (await headers()).get('accept-language') ?? '';
  for (const entry of accepted.split(',')) {
    const tag = entry.split(';')[0]!.trim();
    if (isStudyLocale(tag)) return tag;
    const language = tag.split('-')[0]!;
    if (isStudyLocale(language)) return language;
  }
  return null;
}

export default async function Onboarding({
  params: routeParams,
  searchParams,
}: PageProps<'/[locale]/onboarding'>) {
  const { locale, t } = await getT(routeParams);
  const { me } = await requireMe(locale);
  const params = await searchParams;
  const adding = params.add === '1' && me.studyCountries.length > 0;
  const studying = new Set(me.studyCountries.map((country) => country.countryCode));
  const countries = (await listCountryFacts(getDb())).filter(
    (country) => !studying.has(country.isoCode),
  );
  const requested = parseCountryCode(params.country);
  const preselected = countries.some((country) => country.isoCode === requested) ? requested : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      {adding && (
        <p className="text-sm">
          <Link
            href={localizePath(t.locale, '/study')}
            prefetch
            className={`${focusRing} text-primary-fg rounded-xs underline`}
          >
            {t('common.backToStudy')}
          </Link>
        </p>
      )}
      <h1 className="font-display mt-2 text-4xl font-semibold">
        {adding ? t('onboarding.titleAdd') : t('onboarding.title')}
      </h1>
      <p className="text-fg-muted mt-3">
        {adding ? t('onboarding.introAdd') : t('onboarding.intro')}
      </p>
      <div className="mt-10">
        {countries.length === 0 ? (
          <p className="text-fg-muted">{t('onboarding.allCovered')}</p>
        ) : (
          <I18nProvider locale={locale} messages={clientMessages(locale, ['onboarding'])}>
            <OnboardingForm
              countries={countries}
              preselected={preselected}
              markers={toMarkers(countries, t)}
              adding={adding}
              defaultLocale={
                me.studyCountries[0]?.studyLocale ??
                // Someone reading the app in Spanish most likely wants to study in it.
                (isStudyLocale(locale) ? locale : null) ??
                (await preferredLocale()) ??
                'en'
              }
              defaultDailyGoal={me.settings?.dailyGoalMinutes ?? 15}
              defaultExamDate={
                typeof params.date === 'string' && isIsoDate(params.date) ? params.date : null
              }
            />
          </I18nProvider>
        )}
      </div>
    </main>
  );
}
