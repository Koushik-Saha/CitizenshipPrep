import { AUDIT_PAGE_SIZE, listAdminActions } from '@oathly/api/server';
import type { Metadata } from 'next';
import Link from 'next/link';

import { fieldClass, labelClass } from '@/components/ui';
import { getDb, requireAdmin } from '@/lib/admin';

export const metadata: Metadata = { title: 'Activity' };

const single = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 200) || undefined;

/** What it was done to, as a link where there is a page for it. */
function Target({ type, id }: { type: string | null; id: string | null }) {
  if (!type || !id) return <span className="text-fg-muted">—</span>;
  const href =
    type === 'question'
      ? `/admin/content/questions/${id}`
      : type === 'translation'
        ? `/admin/content/translations/${id}`
        : null;
  const label = `${type} ${id.length > 18 ? `${id.slice(0, 8)}…` : id}`;
  return href ? (
    <Link href={href} className="text-primary-fg underline underline-offset-4">
      {label}
    </Link>
  ) : (
    <span>{label}</span>
  );
}

/** A count or a reason kept with the line, written out; never more than a line. */
function detailText(detail: Record<string, unknown>): string {
  return Object.entries(detail)
    .map(([name, value]) =>
      Array.isArray(value) ? `${name}: ${value.length}` : `${name}: ${String(value)}`,
    )
    .join(', ');
}

// The record of what staff have done here: who, what, to what, and when.
// Admins only. Lines are added by every action and can never be changed.
export default async function Activity({ searchParams }: PageProps<'/admin/activity'>) {
  await requireAdmin();
  const params = await searchParams;
  const actor = single(params.who);
  const action = single(params.what);
  const before = single(params.before);
  const entries = await listAdminActions(getDb(), { actorId: actor, action, before });
  const time = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  });
  const older = new URLSearchParams();
  if (actor) older.set('who', actor);
  if (action) older.set('what', action);
  const last = entries.at(-1);
  if (last) older.set('before', last.id);

  return (
    <>
      <h1 className="font-display text-3xl font-semibold">Activity</h1>
      <p className="text-fg-muted mt-2 max-w-2xl">
        Everything done in the reviewers’ area, newest first. Times are in UTC. Lines are added with
        every action and cannot be changed or removed.
      </p>

      <form className="mt-6 flex flex-wrap items-end gap-4" method="get">
        <div>
          <label htmlFor="what" className={labelClass}>
            Action starts with
          </label>
          <input
            id="what"
            name="what"
            defaultValue={action}
            placeholder="question."
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="who" className={labelClass}>
            Account id
          </label>
          <input id="who" name="who" defaultValue={actor} className={fieldClass} />
        </div>
        <button
          type="submit"
          className="border-border-strong hover:bg-surface-sunken focus-visible:outline-focus-ring rounded-md border px-4 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Filter
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="text-fg-muted mt-8">Nothing recorded{actor || action ? ' for that' : ''}.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <caption className="sr-only">What staff have done, newest first</caption>
            <thead>
              <tr className="border-border text-fg-muted border-b text-start">
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  When (UTC)
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  Who
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  What
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-medium">
                  On
                </th>
                <th scope="col" className="py-2 text-start font-medium">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-border border-b align-top">
                  <td className="py-2 pe-4 whitespace-nowrap">
                    <time dateTime={entry.at}>{time.format(new Date(entry.at))}</time>
                  </td>
                  <td className="py-2 pe-4">
                    <Link
                      href={`/admin/activity?who=${encodeURIComponent(entry.actorId)}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {entry.actorName || entry.actorId}
                    </Link>
                  </td>
                  <td className="py-2 pe-4 font-mono">{entry.action}</td>
                  <td className="py-2 pe-4">
                    <Target type={entry.targetType} id={entry.targetId} />
                  </td>
                  <td className="text-fg-muted py-2">{detailText(entry.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entries.length === AUDIT_PAGE_SIZE && (
        <p className="mt-6">
          <Link
            href={`/admin/activity?${older}`}
            className="text-primary-fg font-medium underline underline-offset-4"
          >
            Older
          </Link>
        </p>
      )}
    </>
  );
}
