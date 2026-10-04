import { listCountryFacts } from '@oathly/api/server';
import type { Metadata } from 'next';

import { CountryCards } from '@/components/landing/sections';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { loadPublic } from '@/lib/public-content';

export const metadata: Metadata = {
  title: 'Citizenship tests by country | Oathly',
  description:
    'The citizenship tests Oathly helps you prepare for: format, pass mark, languages and topics, each checked against the official source.',
};

// Static, rebuilt when content is published (see lib/revalidate.ts) and at
// least hourly.
export const revalidate = 3600;

export default async function Countries() {
  const countries = await loadPublic((db) => listCountryFacts(db), []);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Countries and exams</h1>
        <p className="text-fg-muted mt-4 max-w-2xl text-lg">
          We add a country once its exam format and study material have been checked against
          official sources. More are on the way.
        </p>
        <div className="mt-12">
          <CountryCards countries={countries} headingLevel="h2" />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
