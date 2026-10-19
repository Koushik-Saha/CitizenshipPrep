import type { Metadata } from 'next';
import Link from 'next/link';

import { countOpenFlags } from '@oathly/content/flags';

import { getDb, requireReviewer } from '@/lib/admin';

import { signOut } from '../sign-in/actions';

export const metadata: Metadata = {
  title: 'Content review',
  robots: { index: false, follow: false },
};

/** The pages only admins have, in the order the header lists them. */
const adminPages = [
  ['/admin/users', 'Users'],
  ['/admin/billing', 'Payments'],
  ['/admin/orgs', 'Organizations'],
  ['/admin/ai', 'AI use'],
  ['/admin/activity', 'Activity'],
] as const;

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const reviewer = await requireReviewer();
  const openReports = await countOpenFlags(getDb());
  return (
    <>
      <header className="border-border bg-surface border-b">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 sm:px-8">
          <Link
            href="/admin/content"
            className="font-display inline-flex min-h-11 items-center rounded-xs text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Swornly content review
          </Link>
          <nav aria-label="Sections" className="flex flex-wrap gap-x-4 text-sm font-medium">
            <Link
              href="/admin/content"
              className="inline-flex min-h-11 items-center rounded-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Questions
            </Link>
            <Link
              href="/admin/community"
              className="inline-flex min-h-11 items-center rounded-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Community
            </Link>
            <Link
              href="/admin/flags"
              className="inline-flex min-h-11 items-center rounded-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Reports{openReports > 0 ? ` (${openReports})` : ''}
            </Link>
            <Link
              href="/admin/exams"
              className="inline-flex min-h-11 items-center rounded-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Exam facts
            </Link>
            {reviewer.role === 'admin' &&
              adminPages.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex min-h-11 items-center rounded-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {label}
                </Link>
              ))}
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <p className="text-fg-muted">
              Signed in as <span className="text-fg font-medium">{reviewer.displayName}</span>
              {reviewer.shared && ' (shared account)'}
            </p>
            <form action={signOut}>
              <button
                type="submit"
                className="border-border-strong hover:bg-surface-sunken min-h-11 rounded-md border px-3 py-1.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</main>
    </>
  );
}
