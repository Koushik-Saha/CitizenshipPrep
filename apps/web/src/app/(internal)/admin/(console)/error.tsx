'use client';

import Link from 'next/link';
import { useEffect } from 'react';

// What a member of staff sees when an admin page throws: that it failed, a
// way to try again, and a way back to the queue. The error itself goes to
// error reporting, not to the screen.
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="font-display text-3xl font-semibold">This page could not be shown</h1>
      <p className="text-fg-muted mt-4">
        Something failed on the server. Nothing you were doing has been saved twice: try again, and
        check the page before repeating a decision.
      </p>
      {error.digest && (
        <p className="text-fg-muted mt-2 font-mono text-xs">Reference: {error.digest}</p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className="bg-primary text-on-primary hover:bg-primary-hover focus-visible:outline-focus-ring rounded-md px-4 py-2.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Try again
        </button>
        <Link
          href="/admin/content"
          className="border-border-strong hover:bg-surface-sunken focus-visible:outline-focus-ring rounded-md border px-4 py-2.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Back to the review queue
        </Link>
      </div>
    </div>
  );
}
