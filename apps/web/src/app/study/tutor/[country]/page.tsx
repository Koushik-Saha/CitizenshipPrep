import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { focusRing } from '@/components/ui';
import { requireMe } from '@/lib/user';

import { TutorChat } from './tutor-chat';

export const metadata: Metadata = { title: 'Ask the tutor | Oathly' };

export default async function TutorPage({ params }: PageProps<'/study/tutor/[country]'>) {
  const { me } = await requireMe();
  const code = (await params).country.toUpperCase();
  const country = me.studyCountries.find((candidate) => candidate.countryCode === code);
  if (!country) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <p className="text-sm">
        <Link
          href="/study"
          prefetch
          className={`${focusRing} text-primary-fg rounded-xs underline`}
        >
          Back to study
        </Link>
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold">Ask the tutor</h1>
      <p className="text-fg-muted mt-3">
        Questions about the {country.countryName} citizenship test and its study material. The tutor
        answers from the official guide only, and is AI: check anything important against the guide.
        It cannot advise on your own application.
      </p>
      <TutorChat countryCode={country.countryCode} countryName={country.countryName} />
    </main>
  );
}
