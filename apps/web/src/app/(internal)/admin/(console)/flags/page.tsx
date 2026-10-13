import { FLAGS_PAGE_SIZE, listOpenFlags, type FlagReason } from '@oathly/content/flags';
import { textDirection } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge, fieldClass, labelClass, Notice } from '@/components/ui';
import { getDb, requireReviewer } from '@/lib/admin';

import { decideFlag } from './actions';

export const metadata: Metadata = { title: 'Reports' };

const reasonLabels: Record<FlagReason, string> = {
  incorrect: 'The answer is wrong',
  outdated: 'Out of date',
  unclear: 'Unclear',
  typo: 'Typo',
  translation: 'Translation',
  other: 'Other',
};

const done = {
  fixed: 'Marked as fixed.',
  withdraw: 'The question is withdrawn from learners, and its reports are closed.',
  dismiss: 'Dismissed.',
} as const;

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const button =
  'rounded-md px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

// What learners have reported as wrong with questions, oldest first. Each
// report comes with the question as it was written and its marked answer, so
// a reviewer can decide without opening anything else.
export default async function Flags({ searchParams }: PageProps<'/admin/flags'>) {
  // Checked here as well as in the layout: a page never relies on what wraps it.
  await requireReviewer();
  const params = await searchParams;
  const country = single(params.country)?.toUpperCase();
  const flags = await listOpenFlags(getDb(), {
    countryCode: country && /^[A-Z]{2}$/.test(country) ? country : null,
  });
  const finished = done[single(params.done) as keyof typeof done];
  const problem = single(params.problem);
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Reports from learners</h1>
      <p className="text-fg-muted mt-1 max-w-3xl">
        Problems learners have reported with questions, the longest-waiting first. Open the question
        to correct it and mark the report fixed; withdraw the question if it should not be shown
        until it is put right; or dismiss the report if nothing is wrong.
      </p>
      <div className="mt-4 space-y-3 empty:hidden">
        {finished && (
          <Notice tone="success" role="status">
            {finished}
          </Notice>
        )}
        {problem && (
          <Notice tone="error" role="alert">
            {problem === 'invalid' ? 'That was not a decision.' : problem}
          </Notice>
        )}
      </div>

      {flags.length === 0 ? (
        <p className="text-fg-muted mt-8">No reports are waiting.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {flags.map((flag) => {
            const { question } = flag;
            const wording = { lang: question.locale, dir: textDirection(question.locale) };
            return (
              <li
                key={flag.id}
                className="bg-surface border-border rounded-lg border p-5"
                data-testid="flag-item"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone="error">{reasonLabels[flag.reason] ?? flag.reason}</Badge>
                  <span className="text-fg-muted">
                    {question.countryCode} · {question.topic} · reported{' '}
                    <time dateTime={flag.reportedAt}>{date.format(new Date(flag.reportedAt))}</time>
                    {flag.locale ? ` · read in ${flag.locale}` : ''} · by{' '}
                    {flag.reporterId.slice(0, 12)}
                  </span>
                  {flag.reportsOnQuestion > 1 && (
                    <Badge tone="warning">
                      {flag.reportsOnQuestion} open reports on this question
                    </Badge>
                  )}
                  {question.status !== 'published' && (
                    <Badge tone="neutral">Question is {question.status.replace('_', ' ')}</Badge>
                  )}
                </div>

                <h2 className="mt-3 text-lg font-semibold" {...wording}>
                  {question.text}
                </h2>
                <ul className="mt-2 space-y-1" {...wording}>
                  {question.options.map((option) => {
                    const correct = question.correctKeys.includes(option.key);
                    return (
                      <li key={option.key} className={correct ? 'text-success-fg font-medium' : ''}>
                        <span className="text-fg-muted font-mono text-sm">{option.key}.</span>{' '}
                        {option.text}
                        {correct && <span className="ms-2 text-sm">(marked correct)</span>}
                      </li>
                    );
                  })}
                </ul>
                {question.explanation && (
                  <p className="text-fg-muted mt-2 text-sm" {...wording}>
                    {question.explanation}
                  </p>
                )}

                <blockquote className="border-border mt-4 border-s-4 ps-4">
                  <p className="text-sm font-medium">The learner wrote:</p>
                  <p className="mt-1 whitespace-pre-line" dir="auto">
                    {flag.details ?? <span className="text-fg-muted">Nothing more.</span>}
                  </p>
                </blockquote>

                <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <Link
                    href={`/admin/content/questions/${question.id}`}
                    className="text-primary-fg font-medium underline underline-offset-4"
                  >
                    Open the question to fix it
                  </Link>
                  {question.sourceUrl && (
                    <a
                      href={question.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                      className="text-primary-fg underline underline-offset-4"
                    >
                      Official source
                    </a>
                  )}
                </p>

                <form action={decideFlag} className="mt-4">
                  <input type="hidden" name="id" value={flag.id} />
                  <label htmlFor={`note-${flag.id}`} className={labelClass}>
                    Note (optional; kept with the report)
                  </label>
                  <input
                    id={`note-${flag.id}`}
                    name="note"
                    maxLength={500}
                    className={`${fieldClass} max-w-xl`}
                  />
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="submit"
                      name="decision"
                      value="fixed"
                      className={`${button} bg-primary text-on-primary hover:bg-primary-hover`}
                    >
                      Mark fixed
                    </button>
                    {question.status === 'published' && (
                      <button
                        type="submit"
                        name="decision"
                        value="withdraw"
                        className={`${button} bg-error text-on-error hover:opacity-90`}
                      >
                        Withdraw the question
                      </button>
                    )}
                    <button
                      type="submit"
                      name="decision"
                      value="dismiss"
                      className={`${button} border-border-strong hover:bg-surface-sunken border`}
                    >
                      Dismiss
                    </button>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      {flags.length === FLAGS_PAGE_SIZE && (
        <p className="text-fg-muted mt-6 text-sm">
          Showing the {FLAGS_PAGE_SIZE} longest-waiting. More appear as these are closed.
        </p>
      )}
    </>
  );
}
