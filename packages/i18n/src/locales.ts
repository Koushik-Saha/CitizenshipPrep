// The languages the apps' own text (buttons, headings, messages) comes in.
// Separate from the study languages in ./index: those are what questions can
// be translated into, and there are more of them.

export const uiLocales = ['en', 'es', 'hi', 'bn', 'ar', 'zh-Hans', 'tl', 'vi', 'pt', 'fr'] as const;

export type UiLocale = (typeof uiLocales)[number];

/** The language of the source messages, and of URLs without a language prefix. */
export const defaultLocale: UiLocale = 'en';

export function isUiLocale(value: string): value is UiLocale {
  return (uiLocales as readonly string[]).includes(value);
}

/**
 * Splits a URL path into its language prefix (null when it has none) and the
 * rest: "/es/countries" is Spanish and "/countries".
 */
export function splitLocalePath(pathname: string): { locale: UiLocale | null; path: string } {
  const [, first = '', ...rest] = pathname.split('/');
  if (!isUiLocale(first)) return { locale: null, path: pathname || '/' };
  return { locale: first, path: `/${rest.join('/')}` };
}

/** The URL for a page in a language: no prefix for the default, "/es/..." otherwise. */
export function localizePath(locale: UiLocale, path: string): string {
  if (locale === defaultLocale) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}
