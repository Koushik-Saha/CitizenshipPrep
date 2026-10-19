'use client';

import dynamic from 'next/dynamic';

// Shown for an address with no page, and when a page says what was asked for
// does not exist (a country Swornly does not cover, a session that is not the
// learner's).
//
// This file is part of every page's JavaScript, so it holds only the import:
// the page itself, with the site's header and footer, is a chunk of its own,
// rendered on the server and fetched only when a page is not found.
const NotFoundView = dynamic(() => import('@/components/not-found-view'));

export default function NotFound() {
  return <NotFoundView />;
}
