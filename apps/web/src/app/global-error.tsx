'use client';

import { useEffect } from 'react';

// What is shown when the page's own frame fails: a fault in a root layout,
// where the ordinary error page (app/[locale]/error.tsx) cannot be drawn
// because the layout that holds it is what broke. It stands alone: its own
// <html> and <body>, plain styles, no fonts or messages to load, so that
// nothing it depends on can be the thing that failed. English only, for that
// reason.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#f5f6fa',
          color: '#10172f',
        }}
      >
        <main style={{ maxWidth: '32rem', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: '1rem', lineHeight: 1.5 }}>
            This page could not be shown. Try again, and if it keeps happening, come back a little
            later.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: '2rem',
              padding: '0.65rem 1.1rem',
              font: 'inherit',
              fontWeight: 600,
              color: '#fff',
              background: '#1c2c5b',
              border: 0,
              borderRadius: '0.4rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
