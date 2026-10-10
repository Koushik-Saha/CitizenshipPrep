import { listModerationQueue, type ModerationItem } from '@oathly/api/server';
import type { Metadata } from 'next';

import { Badge, Notice } from '@/components/ui';
import { getDb } from '@/lib/db';

import { decide } from './actions';

export const metadata: Metadata = { title: 'Community moderation' };

const reasonLabels: Record<string, string> = {
  toxicity: 'Screening: abusive',
  spam: 'Screening: spam',
  legal_advice: 'Asks about their own case',
  personal_data: 'Screening: personal details',
  unscreened: 'Could not be screened',
  reports: 'Hidden by reports',
};

function Decision({ item, decision }: { item: ModerationItem; decision: 'approve' | 'remove' }) {
  const approve = decision === 'approve';
  return (
    <form action={decide}>
      <input type="hidden" name="target" value={item.target} />
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="decision" value={decision} />
      <button
        type="submit"
        className={`rounded-md px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${
          approve
            ? 'bg-primary text-on-primary hover:bg-primary-hover'
            : 'bg-error text-on-error hover:opacity-90'
        }`}
      >
        {approve ? (item.hidden ? 'Approve and show' : 'Keep, dismiss reports') : 'Remove'}
      </button>
    </form>
  );
}

// Everything held back from a study group, and anything showing that
// learners have reported. Nothing here reaches other learners until approved.
export default async function CommunityModeration({ searchParams }: PageProps<'/admin/community'>) {
  const queue = await listModerationQueue(getDb());
  const { done, problem } = await searchParams;
  const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Community moderation</h1>
      <p className="text-fg-muted mt-1">
        Held posts are hidden from everyone but their writer until you decide. Approving a post that
        asks about someone’s own case shows it with the notice to see a licensed attorney.
      </p>
      <div className="mt-4 space-y-3 empty:hidden">
        {done === 'approve' && (
          <Notice tone="success" role="status">
            Approved.
          </Notice>
        )}
        {done === 'remove' && (
          <Notice tone="success" role="status">
            Removed.
          </Notice>
        )}
        {problem && (
          <Notice tone="error" role="alert">
            {problem === 'gone' ? 'That is not in the queue any more.' : 'That was not a decision.'}
          </Notice>
        )}
      </div>

      {queue.length === 0 ? (
        <p className="text-fg-muted mt-8">Nothing is waiting.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {queue.map((item) => (
            <li
              key={`${item.target}-${item.id}`}
              className="bg-surface border-border rounded-lg border p-5"
              data-testid="moderation-item"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={item.hidden ? 'warning' : 'neutral'}>
                  {item.hidden ? 'Hidden' : 'Showing'}
                </Badge>
                <span className="font-medium">{item.target === 'post' ? 'Post' : 'Comment'}</span>
                <span className="text-fg-muted">
                  {item.countryCode ?? 'No country'} · {item.author ?? 'A learner'} ·{' '}
                  {date.format(new Date(item.createdAt))}
                </span>
              </div>
              <h2 className="mt-2 text-lg font-semibold">
                {item.target === 'comment' && <span className="text-fg-muted">On: </span>}
                {item.title}
              </h2>
              <p className="mt-1 whitespace-pre-line">{item.body}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {item.heldFor.map((reason) => (
                  <li key={reason}>
                    <Badge tone="warning">{reasonLabels[reason] ?? reason}</Badge>
                  </li>
                ))}
                {item.reports.map((report, index) => (
                  <li key={index}>
                    <Badge tone="error">
                      Reported: {report.reason.replace('_', ' ')}
                      {report.details ? ` (${report.details})` : ''}
                    </Badge>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-3">
                <Decision item={item} decision="approve" />
                <Decision item={item} decision="remove" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
