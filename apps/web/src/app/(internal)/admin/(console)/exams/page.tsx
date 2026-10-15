import { allCorrectSections } from '@oathly/api/countries';
import { listExamFormatsForReview } from '@oathly/content/exam-formats';
import type { Metadata } from 'next';
import { Fragment } from 'react';

import { Badge, Notice } from '@/components/ui';
import { getDb, requireReviewer } from '@/lib/admin';

import { checkExamFormat } from './actions';

export const metadata: Metadata = { title: 'Exam facts' };

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const problems: Record<string, string> = {
  unconfirmed: 'Tick the box to say you have read the official page.',
  missing: 'That exam is no longer current.',
};

const button =
  'rounded-md px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

// The facts each country page states about its exam: how many questions, the
// pass mark, the time, the pool and the rules. They are entered from the
// official page, and the public pages say "details being checked" beside
// them until a reviewer has read that page and confirmed them here.
export default async function ExamFacts({ searchParams }: PageProps<'/admin/exams'>) {
  await requireReviewer();
  const params = await searchParams;
  const formats = await listExamFormatsForReview(getDb());
  const finished = single(params.done);
  const problem = problems[single(params.problem) ?? ''];
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
  const unchecked = formats.filter((format) => !format.lastVerifiedAt).length;

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Exam facts</h1>
      <p className="text-fg-muted mt-1 max-w-3xl">
        What each country page says about its exam. Open the official page, compare every number and
        rule below with it, and confirm. Until then the public pages say the details are being
        checked. Changing the facts later clears the check.
      </p>
      <div className="mt-4 space-y-3 empty:hidden">
        {finished && (
          <Notice tone="success" role="status">
            {`${finished}: marked as checked against its official page.`}
          </Notice>
        )}
        {problem && (
          <Notice tone="error" role="alert">
            {problem}
          </Notice>
        )}
      </div>
      <p className="mt-6 font-medium" data-testid="exams-unchecked">
        {unchecked === 0 ? 'Every exam has been checked.' : `${unchecked} not checked yet.`}
      </p>

      <ul className="mt-4 space-y-4">
        {formats.map((format) => {
          const rules = allCorrectSections(format.blueprint);
          return (
            <li
              key={format.id}
              className="bg-surface border-border rounded-lg border p-5"
              data-testid="exam-format"
            >
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-xl font-semibold">
                  {format.countryName}: {format.name}
                </h2>
                {format.lastVerifiedAt ? (
                  <Badge tone="success">
                    Checked {date.format(new Date(format.lastVerifiedAt))}
                    {format.verifiedByName ? ` by ${format.verifiedByName}` : ''}
                  </Badge>
                ) : (
                  <Badge tone="warning">Not checked</Badge>
                )}
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                <dt className="text-fg-muted">Kind</dt>
                <dd>{format.formatType}</dd>
                <dt className="text-fg-muted">Questions</dt>
                <dd>{format.questionCount ?? 'no fixed number'}</dd>
                <dt className="text-fg-muted">To pass</dt>
                <dd>{format.passMark ?? 'not stated'}</dd>
                <dt className="text-fg-muted">Time</dt>
                <dd>
                  {format.timeLimitMinutes ? `${format.timeLimitMinutes} minutes` : 'no limit'}
                </dd>
                <dt className="text-fg-muted">Official pool</dt>
                <dd>{format.questionPoolSize ?? 'not published'}</dd>
                {rules.map((rule) => (
                  <Fragment key={rule.label}>
                    <dt className="text-fg-muted">Must all be right</dt>
                    <dd>
                      {rule.count} on “{rule.label}”
                    </dd>
                  </Fragment>
                ))}
                {format.notes && (
                  <>
                    <dt className="text-fg-muted">Notes</dt>
                    <dd>{format.notes}</dd>
                  </>
                )}
                <dt className="text-fg-muted">Source</dt>
                <dd>
                  <a
                    href={format.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all underline underline-offset-2"
                  >
                    {format.sourceUrl}
                  </a>
                </dd>
              </dl>
              <form action={checkExamFormat} className="mt-4 flex flex-wrap items-center gap-4">
                <input type="hidden" name="id" value={format.id} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="read" required className="size-4" />I have read the
                  official page, and every fact above matches it
                </label>
                <button type="submit" className={`${button} bg-primary text-on-primary`}>
                  {format.lastVerifiedAt ? 'Checked again today' : 'Mark as checked'}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </>
  );
}
