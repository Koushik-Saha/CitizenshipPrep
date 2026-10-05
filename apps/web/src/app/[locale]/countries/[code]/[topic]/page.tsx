import { countrySlug } from '@oathly/api/countries';
import { countryName, isolate, textDirection, localizePath } from '@oathly/i18n';
import { getTopicGuide, listGuidePaths } from '@oathly/api/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import Link from 'next/link';

import { Breadcrumbs, SiteFooter, SiteHeader } from '@/components/site-chrome';
import { focusRing } from '@/components/ui';
import { getDb } from '@/lib/db';
import { alternates, getT } from '@/lib/i18n';
import { loadPublic } from '@/lib/public-content';

// Built ahead of time for every topic and language, rebuilt when content is
// published (lib/revalidate.ts). The page's own words are in the reader's
// language; the questions stay as the exam words them, since that is what the
// reader will meet on the day. Shows only published questions, which are verified by
// construction (the database refuses to publish an unverified question).
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const paths = await loadPublic((db) => listGuidePaths(db), []);
  return paths.flatMap((path) =>
    path.topics.map((topic) => ({ code: countrySlug(path.isoCode), topic })),
  );
}

const loadGuide = cache((code: string, topic: string) =>
  /^[a-z]{2}$/.test(code) && /^[a-z0-9-]{1,80}$/.test(topic)
    ? getTopicGuide(getDb(), code, topic)
    : Promise.resolve(null),
);

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/countries/[code]/[topic]'>): Promise<Metadata> {
  const { locale, t } = await getT(params);
  const { code, topic } = await params;
  const guide = await loadGuide(code, topic);
  if (!guide) return {};
  const names = {
    topic: guide.topic.name,
    country: countryName(guide.countryCode, locale, guide.countryName),
  };
  return {
    title: t('countries.topicMetaTitle', names),
    description: t('countries.topicMetaDescription', names),
    alternates: alternates(
      locale,
      `/countries/${countrySlug(guide.countryCode)}/${guide.topic.slug}`,
    ),
  };
}

export default async function TopicPage({
  params,
}: PageProps<'/[locale]/countries/[code]/[topic]'>) {
  const { locale, t } = await getT(params);
  const { code, topic } = await params;
  const guide = await loadGuide(code, topic);
  if (!guide) notFound();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const country = countryName(guide.countryCode, locale, guide.countryName);
  const countryPath = `/countries/${countrySlug(guide.countryCode)}`;
  const remaining = guide.topic.publishedQuestions - guide.questions.length;

  return (
    <>
      <SiteHeader t={t} path={`${countryPath}/${guide.topic.slug}`} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Breadcrumbs
          t={t}
          trail={[
            { href: '/countries', label: t('common.countries') },
            { href: countryPath, label: country },
            { label: guide.topic.name },
          ]}
        />
        <h1 className="font-display mt-4 text-4xl font-semibold text-balance">
          {guide.topic.name}
        </h1>
        <p className="text-fg-muted mt-3 text-lg">{t('countries.topicLead', { country })}</p>

        {guide.questions.length === 0 ? (
          <p className="bg-surface border-border mt-10 rounded-lg border p-6">
            {t('countries.topicEmpty')}
          </p>
        ) : (
          <ol className="mt-10 space-y-6">
            {guide.questions.map((question, i) => {
              const correct = question.options.filter((option) =>
                question.correctKeys.includes(option.key),
              );
              // The question keeps its own language and direction; the page's
              // words around it keep the reader's.
              const own = { lang: question.locale, dir: textDirection(question.locale) };
              return (
                <li
                  key={question.id}
                  className="bg-surface border-border rounded-lg border p-5 sm:p-6"
                >
                  <p className="flex gap-2 font-medium">
                    <span className="text-fg-muted tabular-nums">{i + 1}.</span>
                    <span {...own} className="flex-1">
                      {question.text}
                    </span>
                  </p>
                  <ul {...own} className="mt-3 space-y-1.5">
                    {question.options.map((option) => (
                      <li key={option.key} className="text-fg-muted">
                        {option.text}
                      </li>
                    ))}
                  </ul>
                  <details className="group mt-4">
                    <summary
                      className={`${focusRing} text-primary-fg cursor-pointer rounded-xs font-medium`}
                    >
                      {t('countries.showAnswer')}
                    </summary>
                    <div className="mt-3 space-y-2">
                      <p>
                        <span className="font-medium">{t('countries.answerLabel')} </span>
                        <bdi lang={question.locale}>
                          {correct.map((option) => option.text).join('; ')}
                        </bdi>
                      </p>
                      {question.explanation && (
                        <p {...own} className="text-fg-muted">
                          {question.explanation}
                        </p>
                      )}
                      <p className="text-fg-muted text-sm">
                        {question.sourceQuote && (
                          <>{t('countries.fromGuide', { quote: isolate(question.sourceQuote) })} </>
                        )}
                        <a
                          href={question.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${focusRing} rounded-xs underline underline-offset-2`}
                        >
                          {t('countries.source')}
                        </a>
                        {t('exam.factSeparator')}
                        {t('exam.checkedOn', {
                          date: dateFormat.format(new Date(question.lastVerifiedAt)),
                        })}
                      </p>
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}

        <div className="border-border mt-12 border-t pt-8">
          <p className="text-lg">
            {remaining > 0
              ? t('countries.moreInApp', { count: remaining, topic: isolate(guide.topic.name) })
              : t('countries.practiseInApp')}
          </p>
          <Link
            href={localizePath(t.locale, `/sign-in?country=${guide.countryCode}`)}
            className={`${focusRing} bg-primary text-on-primary hover:bg-primary-hover mt-4 inline-flex rounded-md px-5 py-3 font-semibold`}
          >
            {t('countries.studyForTest', { country })}
          </Link>
        </div>

        {guide.otherTopics.length > 0 && (
          <nav aria-labelledby="other-topics" className="mt-12">
            <h2 id="other-topics" className="font-display text-xl font-semibold">
              {t('countries.otherTopics')}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-3">
              {guide.otherTopics.map((other) => (
                <li key={other.slug}>
                  <Link
                    href={localizePath(t.locale, `${countryPath}/${other.slug}`)}
                    className={`${focusRing} border-border-strong hover:bg-surface-sunken inline-block rounded-full border px-4 py-2`}
                  >
                    {other.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
      <SiteFooter t={t} />
    </>
  );
}
