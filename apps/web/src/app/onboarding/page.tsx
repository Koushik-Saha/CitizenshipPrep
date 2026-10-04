import { isStudyLocale } from '@oathly/i18n';
import { parseCountryCode } from '@oathly/api/countries';
import { listCountryFacts } from '@oathly/api/server';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';

import { toMarkers } from '@/components/globe/markers';
import { focusRing } from '@/components/ui';
import { getDb } from '@/lib/db';
import { requireMe } from '@/lib/user';

import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = { title: 'Set up your study | Oathly' };

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

export default async function Onboarding({ searchParams }: PageProps<'/onboarding'>) {
  const { me } = await requireMe();
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
            href="/study"
            prefetch
            className={`${focusRing} text-primary-fg rounded-xs underline`}
          >
            Back to your study plan
          </Link>
        </p>
      )}
      <h1 className="font-display mt-2 text-4xl font-semibold">
        {adding ? 'Add another exam' : 'Set up your study'}
      </h1>
      <p className="text-fg-muted mt-3">
        {adding
          ? 'You can prepare for several citizenship exams at once. Progress is kept separately for each.'
          : 'Four questions, then you can start. You can change any of this later.'}
      </p>
      <div className="mt-10">
        {countries.length === 0 ? (
          <p className="text-fg-muted">You are already studying for every exam Oathly covers.</p>
        ) : (
          <OnboardingForm
            countries={countries}
            preselected={preselected}
            markers={toMarkers(countries)}
            adding={adding}
            defaultLocale={me.studyCountries[0]?.studyLocale ?? (await preferredLocale()) ?? 'en'}
            defaultDailyGoal={me.settings?.dailyGoalMinutes ?? 15}
          />
        )}
      </div>
    </main>
  );
}
