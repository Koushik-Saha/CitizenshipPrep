import type { Metadata } from 'next';
import Link from 'next/link';

import { requireReviewer } from '@/lib/admin';

import { signOut } from '../sign-in/actions';

export const metadata: Metadata = {
  title: 'Content review',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const reviewer = await requireReviewer();
  return (
    <>
      <header className="border-border bg-surface border-b">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 sm:px-8">
          <Link
            href="/admin/content"
            className="font-display rounded-xs text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Oathly content review
          </Link>
          <nav aria-label="Sections" className="flex gap-4 text-sm font-medium">
            <Link
              href="/admin/content"
              className="rounded-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Questions
            </Link>
            <Link
              href="/admin/community"
              className="rounded-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Community
            </Link>
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <p className="text-fg-muted">
              Signed in as <span className="text-fg font-medium">{reviewer.displayName}</span>
            </p>
            <form action={signOut}>
              <button
                type="submit"
                className="border-border-strong hover:bg-surface-sunken rounded-md border px-3 py-1.5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
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
