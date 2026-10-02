import type { Metadata } from 'next';
import Link from 'next/link';

import { requireReviewer } from '@/lib/admin';

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
          <p className="text-fg-muted text-sm">Signed in as {reviewer.displayName}</p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</main>
    </>
  );
}
