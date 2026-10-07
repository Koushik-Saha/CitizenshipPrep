import { testPath } from '@oathly/api/countries';
import { testFaq } from '@oathly/api/seo';
import { getTestGuide, listTestPages } from '@oathly/api/server';
import { breadcrumbSchema } from '@oathly/core';
import { countryName, languageList, localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import {
  ExamFactsTable,
  FaqSection,
  JsonLd,
  LastChecked,
  SampleQuestions,
} from '@/components/seo/test-page';
import { Breadcrumbs, SiteFooter, SiteHeader } from '@/components/site-chrome';
import { focusRing } from '@/components/ui';
import { getDb } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { loadPublic } from '@/lib/public-content';
import { shareMetadata } from '@/lib/seo';
import { absoluteUrl } from '@/lib/site';

// "/canada/citizenship-test": what a country's test involves and a free sample
// of its questions. One static page per country and language, built ahead of
// time for every country in the database; a country added later is built on
// its first visit. Publishing content rebuilds the affected pages
// (lib/revalidate.ts); the hourly revalidate is only a safety net.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const pages = await loadPublic((db) => listTestPages(db), []);
  return pages.map((page) => ({ country: page.slug }));
}

const loadGuide = cache((slug: string, locale: string) =>
  /^[a-z0-9-]{4,80}$/.test(slug) ? getTestGuide(getDb(), slug, locale) : Promise.resolve(null),
);

type Props = PageProps<'/[locale]/[country]/citizenship-test'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, t } = await getT(params);
  const guide = await loadGuide((await params).country, locale);
  if (!guide) return {};
  const country = countryName(guide.isoCode, locale, guide.name);
  return shareMetadata({
    locale,
    path: testPath(guide.slug),
    title: t('countries.countryMetaTitle', { country }),
    heading: t('countries.countryTitle', { country }),
    description: t('countries.countryMetaDescription', { country }),
    image: { countrySlug: guide.slug, alt: t('seo.ogAlt', { country }) },
  });
}

export default async function TestPage({ params }: Props) {
  const { locale, t } = await getT(params);
  const guide = await loadGuide((await params).country, locale);
  if (!guide) notFound();
  const country = countryName(guide.isoCode, locale, guide.name);
  const path = testPath(guide.slug);
  const title = t('countries.countryTitle', { country });
  const signIn = localizePath(locale, `/sign-in?country=${guide.isoCode}`);

  return (
    <>
      <SiteHeader t={t} path={path} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <Breadcrumbs
          t={t}
          trail={[{ href: '/countries', label: t('common.countries') }, { label: title }]}
        />
        <JsonLd
          data={breadcrumbSchema([
            { name: t('common.countries'), url: absoluteUrl(localizePath(locale, '/countries')) },
            { name: title, url: absoluteUrl(localizePath(locale, path)) },
          ])}
        />
        <h1 className="font-display mt-4 text-4xl font-semibold text-balance sm:text-5xl">
          {title}
        </h1>
        <p className="text-fg-muted mt-4 text-lg">
          {guide.publishedQuestions > 0
            ? t('countries.countryLeadWithQuestions', { count: guide.publishedQuestions })
            : t('countries.countryLeadNoQuestions')}
        </p>
        {guide.examLanguages.length > 0 && (
          <p className="text-fg-muted mt-1">
            {t('exam.takenIn', { languages: languageList(guide.examLanguages, locale) })}
          </p>
        )}
        <LastChecked date={guide.lastVerifiedAt} t={t} />
        <div className="mt-8">
          <Link
            href={signIn}
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
              <ExamFactsTable exams={guide.exams} t={t} />
            ) : (
              <p className="text-fg-muted">{t('countries.formatBeingChecked')}</p>
            )}
          </div>
        </section>

        {/* Until a question is checked, the line under the heading says so. */}
        {guide.questions.length > 0 && (
          <section aria-labelledby="samples" className="mt-14">
            <h2 id="samples" className="font-display text-2xl font-semibold">
              {t('seo.samplesTitle', { count: guide.questions.length })}
            </h2>
            <p className="text-fg-muted mt-2">{t('seo.samplesIntro')}</p>
            <div className="mt-6">
              <SampleQuestions
                questions={guide.questions}
                countrySlug={guide.slug}
                showTopic={guide.topics.length > 1}
                t={t}
              />
            </div>
            <div className="border-border mt-8 border-t pt-8">
              <p className="text-lg">{t('countries.practiseInApp')}</p>
              <Link
                href={signIn}
                className={`${focusRing} bg-primary text-on-primary hover:bg-primary-hover mt-4 inline-flex rounded-md px-5 py-3 font-semibold`}
              >
                {t('countries.studyForTest', { country })}
              </Link>
            </div>
          </section>
        )}

        <section aria-labelledby="topics" className="mt-14">
          <h2 id="topics" className="font-display text-2xl font-semibold">
            {t('countries.whatItCovers')}
          </h2>
          {guide.topics.length > 0 ? (
            <ul className="divide-border border-border mt-4 divide-y border-y">
              {guide.topics.map((topic) => {
                const row = 'flex items-center justify-between gap-4 px-2 py-4';
                const name = <bdi className="font-medium">{topic.name}</bdi>;
                return (
                  <li key={topic.slug}>
                    {/* A topic gets a page with its first checked question. */}
                    {topic.publishedQuestions > 0 ? (
                      <Link
                        href={localizePath(locale, testPath(guide.slug, topic.slug))}
                        className={`${focusRing} hover:bg-surface-sunken ${row}`}
                      >
                        {name}
                        <span className="text-fg-muted text-sm">
                          {t('exam.questionCount', { count: topic.publishedQuestions })}
                        </span>
                      </Link>
                    ) : (
                      <p className={row}>
                        {name}
                        <span className="text-fg-muted text-sm">
                          {t('countries.topicBeingChecked')}
                        </span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-fg-muted mt-4">{t('countries.topicsBeingAdded')}</p>
          )}
        </section>

        <FaqSection items={testFaq(guide, country, t)} t={t} />

        <p className="text-fg-muted mt-14 text-sm">{t('countries.bookingNote')}</p>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
