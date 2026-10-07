import { describeExam, testPath } from '@oathly/api/countries';
import { topicFaq } from '@oathly/api/seo';
import { getTopicGuide, listTestPages } from '@oathly/api/server';
import { breadcrumbSchema } from '@oathly/core';
import { countryName, isolate, localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { FaqSection, JsonLd, LastChecked, SampleQuestions } from '@/components/seo/test-page';
import { Breadcrumbs, SiteFooter, SiteHeader } from '@/components/site-chrome';
import { focusRing } from '@/components/ui';
import { getDb } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { loadPublic } from '@/lib/public-content';
import { shareMetadata } from '@/lib/seo';
import { absoluteUrl } from '@/lib/site';

// "/canada/citizenship-test/history": a free sample of one topic's questions.
// Static, one per topic and language, for every topic with a published
// question; a topic gets its page when its first question is published, and
// publishing rebuilds it (lib/revalidate.ts). Only published questions are
// shown, which are verified by construction: the database refuses to publish
// an unverified one.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const pages = await loadPublic((db) => listTestPages(db), []);
  return pages.flatMap((page) =>
    page.topics.map((topic) => ({ country: page.slug, topic: topic.slug })),
  );
}

const loadGuide = cache((slug: string, topic: string, locale: string) =>
  /^[a-z0-9-]{4,80}$/.test(slug) && /^[a-z0-9-]{1,80}$/.test(topic)
    ? getTopicGuide(getDb(), slug, topic, locale)
    : Promise.resolve(null),
);

type Props = PageProps<'/[locale]/[country]/citizenship-test/[topic]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, t } = await getT(params);
  const { country: slug, topic } = await params;
  const guide = await loadGuide(slug, topic, locale);
  if (!guide) return {};
  const country = countryName(guide.country.isoCode, locale, guide.country.name);
  const names = { topic: guide.topic.name, country };
  return shareMetadata({
    locale,
    path: testPath(guide.country.slug, guide.topic.slug),
    title: t('countries.topicMetaTitle', names),
    heading: t('seo.topicTitle', names),
    description: t('countries.topicMetaDescription', names),
    image: { countrySlug: guide.country.slug, alt: t('seo.ogAlt', { country }) },
  });
}

export default async function TopicPage({ params }: Props) {
  const { locale, t } = await getT(params);
  const { country: slug, topic } = await params;
  const guide = await loadGuide(slug, topic, locale);
  if (!guide) notFound();
  const country = countryName(guide.country.isoCode, locale, guide.country.name);
  const countryPath = testPath(guide.country.slug);
  const path = testPath(guide.country.slug, guide.topic.slug);
  const countryTitle = t('countries.countryTitle', { country });
  const remaining = guide.topic.publishedQuestions - guide.questions.length;

  return (
    <>
      <SiteHeader t={t} path={path} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Breadcrumbs
          t={t}
          trail={[
            { href: '/countries', label: t('common.countries') },
            { href: countryPath, label: countryTitle },
            { label: guide.topic.name },
          ]}
        />
        <JsonLd
          data={breadcrumbSchema([
            { name: t('common.countries'), url: absoluteUrl(localizePath(locale, '/countries')) },
            { name: countryTitle, url: absoluteUrl(localizePath(locale, countryPath)) },
            { name: guide.topic.name, url: absoluteUrl(localizePath(locale, path)) },
          ])}
        />
        <h1 className="font-display mt-4 text-4xl font-semibold text-balance">
          {t('seo.topicTitle', { topic: isolate(guide.topic.name), country })}
        </h1>
        <p className="text-fg-muted mt-3 text-lg">{t('countries.topicLead', { country })}</p>
        <LastChecked date={guide.lastVerifiedAt} t={t} />

        <section aria-labelledby="samples" className="mt-10">
          <h2 id="samples" className="font-display text-2xl font-semibold">
            {t('seo.samplesTitle', { count: guide.questions.length })}
          </h2>
          <p className="text-fg-muted mt-2">{t('seo.samplesIntro')}</p>
          <div className="mt-6">
            <SampleQuestions
              questions={guide.questions}
              countrySlug={guide.country.slug}
              showTopic={false}
              t={t}
            />
          </div>
        </section>

        <div className="border-border mt-12 border-t pt-8">
          <p className="text-lg">
            {remaining > 0
              ? t('countries.moreInApp', { count: remaining, topic: isolate(guide.topic.name) })
              : t('countries.practiseInApp')}
          </p>
          <Link
            href={localizePath(locale, `/sign-in?country=${guide.country.isoCode}`)}
            className={`${focusRing} bg-primary text-on-primary hover:bg-primary-hover mt-4 inline-flex rounded-md px-5 py-3 font-semibold`}
          >
            {t('countries.studyForTest', { country })}
          </Link>
        </div>

        {guide.exams.length > 0 && (
          <section aria-labelledby="format" className="mt-14">
            <h2 id="format" className="font-display text-2xl font-semibold">
              {t('countries.theTest')}
            </h2>
            <ul className="mt-4 space-y-3">
              {guide.exams.map((exam) => (
                <li key={exam.name}>
                  <p className="font-medium">
                    <bdi>{exam.name}</bdi>
                  </p>
                  {describeExam(exam, t) && (
                    <p className="text-fg-muted">{describeExam(exam, t)}</p>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4">
              <Link
                href={localizePath(locale, countryPath)}
                className={`${focusRing} text-primary-fg rounded-xs font-medium underline underline-offset-4`}
              >
                {t('seo.allFacts', { country })}
              </Link>
            </p>
          </section>
        )}

        <FaqSection items={topicFaq(guide, country, t)} t={t} />

        {guide.otherTopics.length > 0 && (
          <nav aria-labelledby="other-topics" className="mt-14">
            <h2 id="other-topics" className="font-display text-xl font-semibold">
              {t('countries.otherTopics')}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-3">
              {guide.otherTopics.map((other) => (
                <li key={other.slug}>
                  <Link
                    href={localizePath(locale, testPath(guide.country.slug, other.slug))}
                    className={`${focusRing} border-border-strong hover:bg-surface-sunken inline-block rounded-full border px-4 py-2`}
                  >
                    <bdi>{other.name}</bdi>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <p className="text-fg-muted mt-14 text-sm">{t('countries.bookingNote')}</p>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
