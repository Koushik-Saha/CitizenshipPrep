import Link from 'next/link';

// Small pieces the admin area's tables share.

export const th = 'py-2 pe-4 text-start font-medium';
export const td = 'py-2 pe-4 align-top';
export const adminLink = 'text-primary-fg underline underline-offset-4';

const dateTime = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});
const dateOnly = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' });

/** A moment, in UTC, or a dash when there is none. */
export function When({ at, date = false }: { at: string | null; date?: boolean }) {
  if (!at) return <span className="text-fg-muted">—</span>;
  return <time dateTime={at}>{(date ? dateOnly : dateTime).format(new Date(at))}</time>;
}

/** A table that scrolls sideways on a narrow screen rather than breaking the page. */
export function DataTable({
  caption,
  head,
  children,
}: {
  caption: string;
  head: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-start text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-border text-fg-muted border-b">
            {head.map((label) => (
              <th key={label} scope="col" className={th}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** A learner's name, linked to their page in the admin area. */
export function UserLink({ id, name }: { id: string; name: string | null }) {
  return (
    <Link href={`/admin/users/${encodeURIComponent(id)}`} className={adminLink}>
      {name || id}
    </Link>
  );
}

/** A link out to the Stripe dashboard, where payments are looked at and refunded. */
export function StripeLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <span className="text-fg-muted">—</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={adminLink}>
      {children}
    </a>
  );
}
