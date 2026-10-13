'use client';

// Shown when a root layout itself fails, where the ordinary error page
// (app/[locale]/error.tsx) cannot be drawn. It needs its own <html> and
// <body>, and is in every page's JavaScript, so it is kept as small as it can
// be: plain words, no styles to load, nothing that could be what failed.
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <h1>Something went wrong</h1>
        <p>This page could not be shown. Try again, or come back a little later.</p>
        <button type="button" onClick={retry}>
          Try again
        </button>
      </body>
    </html>
  );
}
