'use client';

import { localizePath, splitLocalePath, type UiLocale } from '@oathly/i18n/locales';
import { useRouter } from 'next/navigation';

import { rememberLocale } from '@/lib/locale-cookie';

/**
 * Makes the language links inside it change language without reloading the
 * page: a client-side navigation that keeps the scroll position and the
 * query string (a country picked on the landing page, say).
 */
export function SoftLanguageLinks({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div
      className="contents"
      onClick={(event) => {
        const link = (event.target as Element).closest('a');
        // Leave modified clicks (new tab, new window) to the browser.
        if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const next = link.hreflang as UiLocale;
        // Remembered at once, so a redirect during the navigation already knows.
        rememberLocale(next);
        link.closest('details')?.removeAttribute('open');
        const { path } = splitLocalePath(window.location.pathname);
        router.push(localizePath(next, path) + window.location.search, { scroll: false });
      }}
    >
      {children}
    </div>
  );
}
