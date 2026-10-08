'use client';

import { useContext } from 'react';

import { focusRing } from '@/components/focus-ring';
import { I18nContext, useLocalePath } from '@/components/i18n/locale';

// Shown for an address with no page, and when a page says what was asked for
// does not exist (a country Oathly does not cover, a session that is not the
// learner's). A Client Component only to read the language the layout set.
//
// It is part of every page's JavaScript, so it stays small: its words are
// plain strings read straight from the layout's messages, without the message
// formatter, and its link is a plain one.
export default function NotFound() {
  const words = useContext(I18nContext).messages.common;
  const home = useLocalePath()('/');
  const title = words?.notFoundTitle ?? 'Page not found';
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <title>{`${title} | Oathly`}</title>
      <h1 className="font-display text-3xl font-semibold">{title}</h1>
      <p className="text-fg-muted mt-4">{words?.notFoundBody}</p>
      <a
        href={home}
        className={`${focusRing} bg-primary text-on-primary hover:bg-primary-hover mt-8 inline-flex rounded-md px-4 py-2.5 font-semibold`}
      >
        {words?.backHome ?? 'Oathly'}
      </a>
    </main>
  );
}
