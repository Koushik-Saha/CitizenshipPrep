import { describeExam } from '@oathly/api/countries';
import { listCountryFacts } from '@oathly/api/server';
import type { Metadata } from 'next';
import Link from 'next/link';

import { LogoLockup } from '@/components/brand/logo';
import { HERO_VIEW } from '@/components/globe/config';
import { GlobePoster } from '@/components/globe/globe-poster';
import { GlobeSlot } from '@/components/globe/globe-slot';
import { toMarkers } from '@/components/globe/markers';
import { CountrySearch } from '@/components/landing/country-search';
import {
  CountryList,
  Faq,
  Features,
  HowItWorks,
  Pricing,
  Testimonials,
} from '@/components/landing/sections';
import { SiteFooter } from '@/components/site-chrome';
import { focusRing } from '@/components/ui';
import { loadPublic } from '@/lib/public-content';

export const metadata: Metadata = {
  title: 'Oathly: citizenship test practice for every country',
  description:
    'Practise for your citizenship test with questions checked against official sources, answers explained in plain language, and an estimate of how ready you are. Independent: not affiliated with any government.',
};

// Built once, then rebuilt at most hourly so new countries appear without a deploy.
export const revalidate = 3600;

const navLink = `${focusRing} rounded-xs text-fg-muted hover:text-fg`;

export default async function Landing() {
  const countries = await loadPublic((db) => listCountryFacts(db), []);
  const markers = toMarkers(countries);
  const searchable = countries.map((country) => {
    const exam = country.exams[0];
    const details = exam ? describeExam(exam) : '';
    return {
      isoCode: country.isoCode,
      name: country.name,
      detail: exam ? (details ? `${exam.name}: ${details}` : exam.name) : '',
    };
  });

  return (
    <>
      <div data-theme="dark" className="bg-canvas text-fg relative overflow-x-clip">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-5 sm:px-6">
          <Link href="/" className={`${focusRing} rounded-xs`}>
            <LogoLockup variant="meridian" layout="integrated" height={26} />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-6 text-sm font-medium">
            <a href="#countries" className={`${navLink} hidden sm:inline`}>
              Countries
            </a>
            <a href="#pricing" className={`${navLink} hidden sm:inline`}>
              Pricing
            </a>
            <a href="#faq" className={`${navLink} hidden sm:inline`}>
              Questions
            </a>
            <Link
              href="/sign-in"
              className={`${focusRing} text-fg rounded-xs underline-offset-4 hover:underline`}
            >
              Sign in
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
              Walk into your citizenship test ready.
            </h1>
            <p className="text-fg-muted mt-5 max-w-lg text-lg">
              Practice questions written from each country’s official study guide, answers explained
              in plain language, and an honest estimate of how ready you are.
            </p>
            <div className="mt-8 max-w-md">
              <CountrySearch countries={searchable} />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/sign-in"
                className={`${focusRing} bg-accent text-on-accent hover:bg-accent-hover inline-flex items-center rounded-md px-5 py-3 font-semibold transition-colors`}
              >
                Start studying free
              </Link>
              <a
                href="#countries"
                className={`${focusRing} rounded-xs underline underline-offset-4`}
              >
                {countries.length > 1
                  ? `See all ${countries.length} countries`
                  : 'See the countries'}
              </a>
            </div>
          </div>
          {/* The globe sits behind the hero copy on small screens and beside it on large ones. */}
          <div className="relative -mx-4 mt-2 sm:mx-0 lg:mt-0 lg:-mr-28">
            <GlobeSlot
              scene="hero"
              view={HERO_VIEW}
              markers={markers}
              selectHref="/sign-in?country={code}"
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
        <HowItWorks />
        <CountryList countries={countries} />
        <Features />
        <Pricing />
        <Testimonials />
        <Faq />
      </main>

      <SiteFooter />
    </>
  );
}
