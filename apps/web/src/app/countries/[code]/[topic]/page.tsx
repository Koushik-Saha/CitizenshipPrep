import { countrySlug } from '@oathly/api/countries';
import { getTopicGuide, listGuidePaths } from '@oathly/api/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { Breadcrumbs, SiteFooter, SiteHeader } from '@/components/site-chrome';
import { focusRing } from '@/components/ui';
import { getDb } from '@/lib/db';
import { loadPublic } from '@/lib/public-content';

// Built ahead of time for every topic, rebuilt when content is published
// (lib/revalidate.ts). Shows only published questions, which are verified by
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
}: PageProps<'/countries/[code]/[topic]'>): Promise<Metadata> {
  const { code, topic } = await params;
  const guide = await loadGuide(code, topic);
  if (!guide) return {};
  return {
    title: `${guide.topic.name}: ${guide.countryName} citizenship test practice | Oathly`,
    description: `Practice questions on ${guide.topic.name} for the ${guide.countryName} citizenship test, each checked against the official guide.`,
  };
}

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });

export default async function TopicPage({ params }: PageProps<'/countries/[code]/[topic]'>) {
  const { code, topic } = await params;
  const guide = await loadGuide(code, topic);
  if (!guide) notFound();
  const countryPath = `/countries/${countrySlug(guide.countryCode)}`;
  const remaining = guide.topic.publishedQuestions - guide.questions.length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Breadcrumbs
          trail={[
            { href: '/countries', label: 'Countries' },
            { href: countryPath, label: guide.countryName },
            { label: guide.topic.name },
          ]}
        />
        <h1 className="font-display mt-4 text-4xl font-semibold text-balance">
          {guide.topic.name}
        </h1>
        <p className="text-fg-muted mt-3 text-lg">
          Practice questions for the {guide.countryName} citizenship test.
        </p>

        {guide.questions.length === 0 ? (
          <p className="bg-surface border-border mt-10 rounded-lg border p-6">
            The questions for this topic are being checked against the official guide. They appear
            here once a reviewer has approved them.
          </p>
        ) : (
          <ol className="mt-10 space-y-6">
            {guide.questions.map((question, i) => {
              const correct = question.options.filter((option) =>
                question.correctKeys.includes(option.key),
              );
              return (
                <li
                  key={question.id}
                  lang={question.locale}
                  className="bg-surface border-border rounded-lg border p-5 sm:p-6"
                >
                  <p className="font-medium">
                    <span className="text-fg-muted mr-2 tabular-nums">{i + 1}.</span>
                    {question.text}
                  </p>
                  <ul className="mt-3 space-y-1.5">
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
                      Show the answer
                    </summary>
                    <div className="mt-3 space-y-2">
                      <p>
                        <span className="font-medium">Answer: </span>
                        {correct.map((option) => option.text).join('; ')}
                      </p>
                      {question.explanation && (
                        <p className="text-fg-muted">{question.explanation}</p>
                      )}
                      <p className="text-fg-muted text-sm">
                        {question.sourceQuote && (
                          <>From the official guide: “{question.sourceQuote}” </>
                        )}
                        <a
                          href={question.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${focusRing} rounded-xs underline underline-offset-2`}
                        >
                          Source
                        </a>
                        , checked {dateFormat.format(new Date(question.lastVerifiedAt))}
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
              ? `${remaining} more ${guide.topic.name} questions, with explanations and spaced review, are waiting in Oathly.`
              : 'Practise with explanations, spaced review and mock exams in Oathly.'}
          </p>
          <Link
            href={`/sign-in?country=${guide.countryCode}`}
            className={`${focusRing} bg-primary text-on-primary hover:bg-primary-hover mt-4 inline-flex rounded-md px-5 py-3 font-semibold`}
          >
            Study for the {guide.countryName} test
          </Link>
        </div>

        {guide.otherTopics.length > 0 && (
          <nav aria-labelledby="other-topics" className="mt-12">
            <h2 id="other-topics" className="font-display text-xl font-semibold">
              Other topics
            </h2>
            <ul className="mt-3 flex flex-wrap gap-3">
              {guide.otherTopics.map((other) => (
                <li key={other.slug}>
                  <Link
                    href={`${countryPath}/${other.slug}`}
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
      <SiteFooter />
    </>
  );
}
