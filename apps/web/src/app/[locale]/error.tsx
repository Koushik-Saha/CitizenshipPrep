'use client';

import { useContext, useEffect } from 'react';

import { focusRing } from '@/components/focus-ring';
import { I18nContext } from '@/components/i18n/locale';

// What a learner sees when a page throws: a plain message and a way to try
// again, in their language. The error itself goes to error reporting, not to
// the screen.
//
// Part of every page's JavaScript, so it stays small: plain strings from the
// layout's messages, no message formatter (see not-found.tsx).
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const words = useContext(I18nContext).messages.common;
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
  }, [error]);

  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">
        {words?.errorTitle ?? 'Something went wrong'}
      </h1>
      <p className="text-fg-muted mt-4">{words?.errorBody}</p>
      <button
        type="button"
        onClick={reset}
        className={`${focusRing} bg-primary text-on-primary hover:bg-primary-hover mt-8 inline-flex rounded-md px-4 py-2.5 font-semibold`}
      >
        {words?.tryAgain ?? 'Try again'}
      </button>
    </main>
  );
}
