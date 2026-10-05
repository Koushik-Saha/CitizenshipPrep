import {
  isUiLocale,
  localizePath,
  pickMessages,
  uiLocales,
  type MessageGroup,
  type PartialMessages,
  type Translator,
  type UiLocale,
} from '@oathly/i18n';
import { catalogs, translatorFor, type Messages } from '@oathly/i18n/messages';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { LOCALE_COOKIE } from './locale-cookie';

// Server-side translation for pages under app/[locale]. The language is part
// of the URL, so pages stay static: one prerendered copy per language.

/** For generateStaticParams: one entry per UI language. */
export const localeParams = () => uiLocales.map((locale) => ({ locale }));

/** The page's language and a lookup for its messages; 404 for a language Oathly does not have. */
export async function getT(
  params: Promise<{ locale: string }>,
): Promise<{ locale: UiLocale; t: Translator; messages: Messages }> {
  const { locale } = await params;
  if (!isUiLocale(locale)) notFound();
  return { locale, t: translatorFor(locale), messages: catalogs[locale] };
}

/** The message groups a part of the app's Client Components need, to hand to I18nProvider. */
export function clientMessages(locale: UiLocale, groups: readonly MessageGroup[]): PartialMessages {
  return pickMessages(catalogs[locale], groups);
}

/**
 * A page's address in every language, for search engines (hreflang) and the
 * canonical link. `path` is the page without a language prefix.
 */
export function alternates(locale: UiLocale, path: string): Metadata['alternates'] {
  return {
    canonical: localizePath(locale, path),
    languages: {
      ...Object.fromEntries(uiLocales.map((other) => [other, localizePath(other, path)])),
      'x-default': localizePath('en', path),
    },
  };
}

/**
 * A path in the language of the page the request came from, for redirects
 * from Server Actions and route handlers, which have no [locale] of their
 * own. The cookie is kept current by every page view.
 */
export async function localizedPath(path: string): Promise<string> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  return localizePath(chosen && isUiLocale(chosen) ? chosen : 'en', path);
}
