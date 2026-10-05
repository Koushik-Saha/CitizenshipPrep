import { localizePath } from '@oathly/i18n';
import { describeExam } from '@oathly/api/countries';
import { listCountryFacts } from '@oathly/api/server';
import { localCountryName } from '@oathly/api/countries';
import type { Metadata } from 'next';
import Link from 'next/link';

import { LogoLockup } from '@/components/brand/logo';
import { HERO_VIEW } from '@/components/globe/config';
import { GlobePoster } from '@/components/globe/globe-poster';
import { GlobeSlot } from '@/components/globe/globe-slot';
import { toMarkers } from '@/components/globe/markers';
import { CountrySearch, MAX_MATCHES, QUERY_SLOT } from '@/components/landing/country-search';
import {
  CountryList,
  Faq,
  Features,
  HowItWorks,
  Pricing,
  Testimonials,
} from '@/components/landing/sections';
import { LanguageMenu } from '@/components/i18n/language-menu';
import { SiteFooter } from '@/components/site-chrome';
import { focusRing } from '@/components/ui';
import { alternates, getT } from '@/lib/i18n';
import { loadPublic } from '@/lib/public-content';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale, t } = await getT(params);
  return {
    title: t('landing.metaTitle'),
    description: t('landing.metaDescription'),
    alternates: alternates(locale, '/'),
  };
}

// Built once, then rebuilt at most hourly so new countries appear without a deploy.
export const revalidate = 3600;

const navLink = `${focusRing} rounded-xs text-fg-muted hover:text-fg`;

export default async function Landing({ params }: PageProps<'/[locale]'>) {
  const { t } = await getT(params);
  const countries = await loadPublic((db) => listCountryFacts(db), []);
  const markers = toMarkers(countries, t);
  // Picking a country, in the search or on the globe, goes to signing up for it.
  const startHref = localizePath(t.locale, '/sign-in?country={code}');
  const searchable = countries.map((country) => {
    const exam = country.exams[0];
    const details = exam ? describeExam(exam, t) : '';
    return {
      isoCode: country.isoCode,
      name: localCountryName(country, t),
      detail: exam ? (details ? `${exam.name}: ${details}` : exam.name) : '',
    };
  });

  return (
    <>
      <div data-theme="dark" className="bg-canvas text-fg relative overflow-x-clip">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-5 sm:px-6">
          <Link href={localizePath(t.locale, '/')} className={`${focusRing} rounded-xs`}>
            <LogoLockup variant="meridian" layout="integrated" height={26} />
          </Link>
          <nav
            aria-label={t('common.mainNav')}
            className="flex items-center gap-4 text-sm font-medium sm:gap-6"
          >
            <a href="#countries" className={`${navLink} hidden md:inline`}>
              {t('common.countries')}
            </a>
            <a href="#pricing" className={`${navLink} hidden md:inline`}>
              {t('common.pricing')}
            </a>
            <a href="#faq" className={`${navLink} hidden md:inline`}>
              {t('common.faq')}
            </a>
            <LanguageMenu locale={t.locale} label={t('common.language')} path="/" />
            <Link
              href={localizePath(t.locale, '/sign-in')}
              className={`${focusRing} text-fg rounded-xs underline-offset-4 hover:underline`}
            >
              {t('common.signIn')}
            </Link>
          </nav>
        </header>

        <section
          aria-labelledby="hero-heading"
          className="mx-auto grid max-w-6xl items-center gap-x-4 px-4 pt-6 pb-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:pt-10 lg:pb-16"
        >
          <div className="relative z-10 max-w-xl">
            <h1
              id="hero-heading"
              className="font-display text-4xl font-semibold text-balance sm:text-5xl lg:text-6xl"
            >
              {t('landing.heroTitle')}
            </h1>
            <p className="text-fg-muted mt-5 max-w-lg text-lg">{t('landing.heroBody')}</p>
            <div className="mt-8 max-w-md">
              <CountrySearch
                countries={searchable}
                startHref={startHref}
                text={{
                  label: t('landing.searchLabel'),
                  noMatch: t('landing.searchNoMatch', { query: QUERY_SLOT }),
                  statusNone: t('landing.searchStatusNone'),
                  status: Array.from({ length: MAX_MATCHES }, (_, i) =>
                    t('landing.searchStatus', { count: i + 1 }),
                  ),
                }}
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href={localizePath(t.locale, '/sign-in')}
                className={`${focusRing} bg-accent text-on-accent hover:bg-accent-hover inline-flex items-center rounded-md px-5 py-3 font-semibold transition-colors`}
              >
                {t('landing.startFree')}
              </Link>
              <a
                href="#countries"
                className={`${focusRing} rounded-xs underline underline-offset-4`}
              >
                {t('landing.seeCountries', { count: countries.length })}
              </a>
            </div>
          </div>
          {/* The globe sits behind the hero copy on small screens and beside it on large ones. */}
          <div className="relative -mx-4 mt-2 sm:mx-0 lg:mt-0 lg:-me-28">
            <GlobeSlot
              scene="hero"
              view={HERO_VIEW}
              markers={markers}
              selectHref={startHref}
              className="mx-auto w-full max-w-[34rem] lg:max-w-none"
            >
              <GlobePoster
                view={HERO_VIEW}
                markers={markers}
                sizes="(min-width: 1024px) 680px, (min-width: 640px) 544px, 100vw"
                priority
              />
            </GlobeSlot>
          </div>
        </section>
      </div>

      <main>
        <HowItWorks t={t} />
        <CountryList countries={countries} t={t} />
        <Features t={t} />
        <Pricing t={t} />
        <Testimonials t={t} />
        <Faq t={t} />
      </main>

      <SiteFooter t={t} />
    </>
  );
}
