import { endonym, localizePath, uiLocales, type UiLocale } from '@oathly/i18n';

import { focusRing } from '@/components/focus-ring';

import { SoftLanguageLinks } from './soft-language-links';

/**
 * Changes the language of the page. Each language is a plain link to the
 * same page under its own URL, so it works without JavaScript and search
 * engines can follow it; SoftLanguageLinks turns a click into a client-side
 * navigation. Rendered on the server wherever it can be: only the click
 * handler is sent to the browser.
 */
export function LanguageMenu({
  locale,
  label,
  path,
}: {
  /** The page's language. */
  locale: UiLocale;
  /** "Language", in the page's language, for screen readers. */
  label: string;
  /** The page's path without a language prefix: "/countries". */
  path: string;
}) {
  return (
    <SoftLanguageLinks>
      <details className="relative">
        <summary
          className={`${focusRing} text-fg-muted hover:text-fg cursor-pointer list-none rounded-xs [&::-webkit-details-marker]:hidden`}
        >
          <span className="sr-only">{label}: </span>
          <span lang={locale}>{endonym(locale)}</span>
          <span aria-hidden="true"> ▾</span>
        </summary>
        <ul className="bg-surface-raised border-border absolute end-0 z-30 mt-2 max-h-80 w-44 overflow-y-auto rounded-md border py-1 shadow-xl">
          {uiLocales.map((option) => (
            <li key={option}>
              {/* Not next/link: nine prefetches a page for a rare action is not worth it,
                  and SoftLanguageLinks does the navigating. */}
              <a
                href={localizePath(option, path)}
                hrefLang={option}
                lang={option}
                aria-current={option === locale ? 'true' : undefined}
                className={`${focusRing} text-fg hover:bg-surface-sunken block px-4 py-2 focus-visible:-outline-offset-2 ${option === locale ? 'font-semibold' : ''}`}
              >
                {endonym(option)}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </SoftLanguageLinks>
  );
}
