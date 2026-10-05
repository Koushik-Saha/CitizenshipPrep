import { listCountryFacts } from '@oathly/api/server';
import type { Metadata } from 'next';

import { CountryCards } from '@/components/landing/sections';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { alternates, getT } from '@/lib/i18n';
import { loadPublic } from '@/lib/public-content';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/countries'>): Promise<Metadata> {
  const { locale, t } = await getT(params);
  return {
    title: t('countries.indexMetaTitle'),
    description: t('countries.indexMetaDescription'),
    alternates: alternates(locale, '/countries'),
  };
}

// Static, rebuilt when content is published (see lib/revalidate.ts) and at
// least hourly.
export const revalidate = 3600;

export default async function Countries({ params }: PageProps<'/[locale]/countries'>) {
  const { t } = await getT(params);
  const countries = await loadPublic((db) => listCountryFacts(db), []);
  return (
    <>
      <SiteHeader t={t} path="/countries" />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">
          {t('landing.countriesTitle')}
        </h1>
        <p className="text-fg-muted mt-4 max-w-2xl text-lg">{t('landing.countriesIntro')}</p>
        <div className="mt-12">
          <CountryCards countries={countries} t={t} headingLevel="h2" />
        </div>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
