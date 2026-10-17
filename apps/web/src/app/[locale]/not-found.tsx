'use client';

import { splitLocalePath } from '@oathly/i18n/locales';
import type { Translator } from '@oathly/i18n';
import { usePathname } from 'next/navigation';
import { useContext } from 'react';

import { focusRing } from '@/components/focus-ring';
import { I18nContext, useLocalePath } from '@/components/i18n/locale';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';

// Shown for an address with no page, and when a page says what was asked for
// does not exist (a country Oathly does not cover, a session that is not the
// learner's), with the site's header and footer around it so the visitor can
// go on from here. A Client Component only to read the language the layout set.
//
// It is part of every page's JavaScript, so it stays small: its words, and the
// header's and footer's, are plain strings read straight from the layout's
// `common` messages, without the message formatter.
export default function NotFound() {
  const { locale, messages } = useContext(I18nContext);
  const words = messages.common;
  const home = useLocalePath()('/');
  const path = splitLocalePath(usePathname() ?? '/').path;
  const title = words?.notFoundTitle ?? 'Page not found';
  // The chrome's words have no placeholders: a lookup is all it needs.
  const t = Object.assign(
    (key: string) => {
      const [group, name] = key.split('.') as [keyof typeof messages, string];
      return (messages[group] as Record<string, string> | undefined)?.[name] ?? '';
    },
    { locale },
  ) as unknown as Translator;
  return (
    <>
      <SiteHeader t={t} path={path} />
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <title>{`${title} | Oathly`}</title>
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="text-fg-muted mt-4">{words?.notFoundBody}</p>
        <a
          href={home}
          className={`${focusRing} bg-primary text-on-primary hover:bg-primary-hover mt-8 inline-flex min-h-11 items-center rounded-md px-4 py-2.5 font-semibold`}
        >
          {words?.backHome ?? 'Oathly'}
        </a>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
