/**
 * The cookie that remembers someone's language. The proxy reads it to send a
 * plain URL to the right language, and sets it as pages are read; the
 * language menu sets it when English is chosen.
 */
export const LOCALE_COOKIE = 'oathly_locale';

/** A year, in seconds. */
export const LOCALE_COOKIE_MAX_AGE = 31_536_000;

/** Remembers a language. Browser only. */
export function rememberLocale(locale: string): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}
