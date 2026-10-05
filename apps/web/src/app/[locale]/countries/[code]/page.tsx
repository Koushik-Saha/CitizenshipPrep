import { countrySlug } from '@oathly/api/countries';
import { countryName, languageList, localizePath } from '@oathly/i18n';
import { getCountryGuide, listGuidePaths } from '@oathly/api/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import Link from 'next/link';

import { ExamFactsList } from '@/components/landing/sections';
import { Breadcrumbs, SiteFooter, SiteHeader } from '@/components/site-chrome';
import { focusRing } from '@/components/ui';
import { getDb } from '@/lib/db';
import { alternates, getT } from '@/lib/i18n';
import { loadPublic } from '@/lib/public-content';

// One page per country and language, built ahead of time for every country in
// the database. A country added later is built on its first visit. Publishing
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
}: PageProps<'/[locale]/countries/[code]'>): Promise<Metadata> {
  const { locale, t } = await getT(params);
  const guide = await loadGuide((await params).code);
  if (!guide) return {};
  const country = countryName(guide.isoCode, locale, guide.name);
  return {
    title: t('countries.countryMetaTitle', { country }),
    description: t('countries.countryMetaDescription', { country }),
    alternates: alternates(locale, `/countries/${countrySlug(guide.isoCode)}`),
  };
}

export default async function CountryPage({ params }: PageProps<'/[locale]/countries/[code]'>) {
  const { locale, t } = await getT(params);
  const guide = await loadGuide((await params).code);
  if (!guide) notFound();
  const slug = countrySlug(guide.isoCode);
  const country = countryName(guide.isoCode, locale, guide.name);

  return (
    <>
      <SiteHeader t={t} path={`/countries/${slug}`} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <Breadcrumbs
          t={t}
          trail={[{ href: '/countries', label: t('common.countries') }, { label: country }]}
        />
        <h1 className="font-display mt-4 text-4xl font-semibold text-balance sm:text-5xl">
          {t('countries.countryTitle', { country })}
        </h1>
        <p className="text-fg-muted mt-4 text-lg">
          {guide.publishedQuestions > 0
            ? t('countries.countryLeadWithQuestions', { count: guide.publishedQuestions })
            : t('countries.countryLeadNoQuestions')}
        </p>
        <p className="text-fg-muted mt-1">
          {t('exam.takenIn', { languages: languageList(guide.examLanguages, locale) })}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href={localizePath(t.locale, `/sign-in?country=${guide.isoCode}`)}
            className={`${focusRing} bg-primary text-on-primary hover:bg-primary-hover inline-flex rounded-md px-5 py-3 font-semibold`}
          >
            {t('countries.studyForTest', { country })}
          </Link>
        </div>

        <section aria-labelledby="format" className="mt-14">
          <h2 id="format" className="font-display text-2xl font-semibold">
            {t('countries.theTest')}
          </h2>
          <div className="mt-4">
            {guide.exams.length > 0 ? (
              <ExamFactsList exams={guide.exams} t={t} />
            ) : (
              <p className="text-fg-muted">{t('countries.formatBeingChecked')}</p>
            )}
          </div>
        </section>

        <section aria-labelledby="topics" className="mt-14">
          <h2 id="topics" className="font-display text-2xl font-semibold">
            {t('countries.whatItCovers')}
          </h2>
          {guide.topics.length > 0 ? (
            <ul className="divide-border border-border mt-4 divide-y border-y">
              {guide.topics.map((topic) => (
                <li key={topic.slug}>
                  <Link
                    href={localizePath(t.locale, `/countries/${slug}/${topic.slug}`)}
                    className={`${focusRing} hover:bg-surface-sunken flex items-center justify-between gap-4 px-2 py-4`}
                  >
                    <span className="font-medium">{topic.name}</span>
                    <span className="text-fg-muted text-sm">
                      {topic.publishedQuestions > 0
                        ? t('exam.questionCount', { count: topic.publishedQuestions })
                        : t('countries.topicBeingChecked')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted mt-4">{t('countries.topicsBeingAdded')}</p>
          )}
        </section>

        <p className="text-fg-muted mt-14 text-sm">{t('countries.bookingNote')}</p>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
