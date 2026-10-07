// The parts the public test pages share: the country's page and each topic's.
// Server Components, no JavaScript of their own: answers open with <details>.

import type { ExamDetails, GuideQuestion } from '@oathly/api/countries';
import { testPath } from '@oathly/api/countries';
import { examFactRows, type FaqEntry } from '@oathly/api/seo';
import { faqPageSchema, jsonLdScript } from '@oathly/core';
import { isolate, localizePath, textDirection, type Translator } from '@oathly/i18n';
import Link from 'next/link';

import { focusRing } from '@/components/ui';

const longDate = (t: Translator) =>
  new Intl.DateTimeFormat(t.locale, { dateStyle: 'long', timeZone: 'UTC' });

/** Structured data for search engines. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
  );
}

/** "Last checked against the official sources: 12 September 2026" */
export function LastChecked({ date, t }: { date: string | null; t: Translator }) {
  return (
    <p className="text-fg-muted mt-4 text-sm">
      {date ? (
        <>
          {t('seo.lastChecked')}{' '}
          <time dateTime={date.slice(0, 10)} className="text-fg font-medium">
            {longDate(t).format(new Date(date))}
          </time>
        </>
      ) : (
        t('seo.beingChecked')
      )}
    </p>
  );
}

/** Each current exam format: its numbers as a table, its rules, and where they come from. */
export function ExamFactsTable({ exams, t }: { exams: ExamDetails[]; t: Translator }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {exams.map((exam) => (
        <article key={exam.name} className="bg-surface border-border rounded-lg border p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold">
            <bdi>{exam.name}</bdi>
          </h3>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
            {examFactRows(exam, t).map((row) => (
              <div key={row.id} className="col-span-2 grid grid-cols-subgrid">
                <dt className="text-fg-muted">{row.label}</dt>
                <dd className="font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
          {exam.notes && (
            <p className="mt-4">
              <span className="font-medium">{t('seo.factNotes')}: </span>
              {/* As the source words it, in the source's language. */}
              <bdi className="text-fg-muted">{exam.notes}</bdi>
            </p>
          )}
          <p className="text-fg-muted mt-4 text-sm">
            <a
              href={exam.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${focusRing} rounded-xs underline underline-offset-2`}
            >
              {t('exam.officialSource')}
            </a>
            {t('exam.factSeparator')}
            {exam.lastVerifiedAt
              ? t('exam.checkedOn', { date: longDate(t).format(new Date(exam.lastVerifiedAt)) })
              : t('exam.detailsBeingChecked')}
          </p>
        </article>
      ))}
    </div>
  );
}

const answerText = (question: Pick<GuideQuestion, 'options'>, correctKeys: string[]) =>
  question.options
    .filter((option) => correctKeys.includes(option.key))
    .map((option) => option.text)
    .join('; ');

/**
 * Sample questions, each with its answer, the reason and the source behind a
 * disclosure. A question is in the reader's language where a reviewed
 * translation exists, with the exam's own wording beside the answer, and in
 * the exam's language otherwise: its text keeps its own language and
 * direction either way.
 */
export function SampleQuestions({
  questions,
  countrySlug,
  showTopic,
  t,
}: {
  questions: GuideQuestion[];
  countrySlug: string;
  /** Name each question's topic, linking to its page (the country's page mixes topics). */
  showTopic: boolean;
  t: Translator;
}) {
  return (
    <ol className="space-y-6">
      {questions.map((question, i) => {
        const own = { lang: question.locale, dir: textDirection(question.locale) };
        const original = question.original;
        return (
          <li key={question.id} className="bg-surface border-border rounded-lg border p-5 sm:p-6">
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
                  <bdi lang={question.locale}>{answerText(question, question.correctKeys)}</bdi>
                </p>
                {question.explanation && (
                  <p {...own} className="text-fg-muted">
                    {question.explanation}
                  </p>
                )}
                {original && (
                  <p className="text-fg-muted">
                    <span className="font-medium">{t('seo.originalWording')} </span>
                    <bdi lang={original.locale}>
                      {original.text}{' '}
                      <span className="text-fg font-medium">
                        {answerText(original, question.correctKeys)}
                      </span>
                    </bdi>
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
                    {t('exam.officialSource')}
                  </a>
                  {t('exam.factSeparator')}
                  {t('exam.checkedOn', {
                    date: longDate(t).format(new Date(question.lastVerifiedAt)),
                  })}
                </p>
              </div>
            </details>
            {showTopic && (
              <p className="mt-4 text-sm">
                <Link
                  href={localizePath(t.locale, testPath(countrySlug, question.topic.slug))}
                  className={`${focusRing} border-border-strong hover:bg-surface-sunken inline-block rounded-full border px-3 py-1`}
                >
                  <bdi>{question.topic.name}</bdi>
                </Link>
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The common questions, in full on the page, and the same words as FAQPage
 * structured data: search engines only accept markup for what the reader can
 * see.
 */
export function FaqSection({ items, t }: { items: FaqEntry[]; t: Translator }) {
  return (
    <section aria-labelledby="faq" className="mt-14">
      <h2 id="faq" className="font-display text-2xl font-semibold">
        {t('seo.faqTitle')}
      </h2>
      <dl className="divide-border border-border mt-4 divide-y border-y">
        {items.map((item) => (
          <div key={item.question} className="py-5">
            <dt className="font-display text-lg font-medium">{item.question}</dt>
            <dd className="text-fg-muted mt-2">
              {item.answer}
              {item.link && (
                <>
                  {' '}
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${focusRing} text-fg rounded-xs underline underline-offset-2`}
                  >
                    {t('exam.officialSource')}
                  </a>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <JsonLd data={faqPageSchema(items)} />
    </section>
  );
}
