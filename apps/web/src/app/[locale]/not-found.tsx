'use client';

import { lazy, Suspense } from 'react';

// Shown for an address with no page, and when a page says what was asked for
// does not exist (a country Swornly does not cover, a session that is not the
// learner's).
//
// This file is part of every page's JavaScript, so it holds only the import:
// the page itself, with the site's header and footer, is a chunk of its own,
// rendered on the server and fetched only when a page is not found. React's
// lazy rather than next/dynamic, whose loader would be in every page too.
const NotFoundView = lazy(() => import('@/components/not-found-view'));

export default function NotFound() {
  return (
    <Suspense fallback={null}>
      <NotFoundView />
    </Suspense>
  );
}
