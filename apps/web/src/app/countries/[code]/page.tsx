import { countrySlug, examLanguageList } from '@oathly/api/countries';
import { getCountryGuide, listGuidePaths } from '@oathly/api/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { ExamFactsList } from '@/components/landing/sections';
import { Breadcrumbs, SiteFooter, SiteHeader } from '@/components/site-chrome';
import { focusRing } from '@/components/ui';
import { getDb } from '@/lib/db';
import { loadPublic } from '@/lib/public-content';

// One page per country, built ahead of time for every country in the
// database. A country added later is built on its first visit. Publishing
// content rebuilds the affected pages (lib/revalidate.ts); the hourly
// revalidate is only a safety net.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const paths = await loadPublic((db) => listGuidePaths(db), []);
  return paths.map((path) => ({ code: countrySlug(path.isoCode) }));
}

const loadGuide = cache((code: string) =>
  /^[a-z]{2}$/.test(code) ? getCountryGuide(getDb(), code) : Promise.resolve(null),
);

export async function generateMetadata({
  params,
}: PageProps<'/countries/[code]'>): Promise<Metadata> {
  const guide = await loadGuide((await params).code);
  if (!guide) return {};
  return {
    title: `${guide.name} citizenship test: format, topics and practice | Oathly`,
    description: `What the ${guide.name} citizenship test involves, what it covers, and practice questions checked against the official guide.`,
  };
}

export default async function CountryPage({ params }: PageProps<'/countries/[code]'>) {
  const guide = await loadGuide((await params).code);
  if (!guide) notFound();
  const slug = countrySlug(guide.isoCode);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <Breadcrumbs trail={[{ href: '/countries', label: 'Countries' }, { label: guide.name }]} />
        <h1 className="font-display mt-4 text-4xl font-semibold text-balance sm:text-5xl">
          {guide.name} citizenship test
        </h1>
        <p className="text-fg-muted mt-4 text-lg">
          Taken in {examLanguageList(guide.examLanguages)}.{' '}
          {guide.publishedQuestions > 0
            ? `${guide.publishedQuestions} practice questions, each checked against the official guide.`
            : 'Practice questions are being checked against the official guide.'}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href={`/sign-in?country=${guide.isoCode}`}
            className={`${focusRing} bg-primary text-on-primary hover:bg-primary-hover inline-flex rounded-md px-5 py-3 font-semibold`}
          >
            Study for the {guide.name} test
          </Link>
        </div>

        <section aria-labelledby="format" className="mt-14">
          <h2 id="format" className="font-display text-2xl font-semibold">
            The test
          </h2>
          <div className="mt-4">
            {guide.exams.length > 0 ? (
              <ExamFactsList exams={guide.exams} />
            ) : (
              <p className="text-fg-muted">The exam format is being checked.</p>
            )}
          </div>
        </section>

        <section aria-labelledby="topics" className="mt-14">
          <h2 id="topics" className="font-display text-2xl font-semibold">
            What it covers
          </h2>
          {guide.topics.length > 0 ? (
            <ul className="divide-border border-border mt-4 divide-y border-y">
              {guide.topics.map((topic) => (
                <li key={topic.slug}>
                  <Link
                    href={`/countries/${slug}/${topic.slug}`}
                    className={`${focusRing} hover:bg-surface-sunken flex items-center justify-between gap-4 px-2 py-4`}
                  >
                    <span className="font-medium">{topic.name}</span>
                    <span className="text-fg-muted text-sm">
                      {topic.publishedQuestions > 0
                        ? `${topic.publishedQuestions} questions`
                        : 'Being checked'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted mt-4">Topics are being added.</p>
          )}
        </section>

        <p className="text-fg-muted mt-14 text-sm">
          To book the test or check the rules that apply to you, use the official website linked
          above. Oathly is an independent study app and is not affiliated with any government.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
