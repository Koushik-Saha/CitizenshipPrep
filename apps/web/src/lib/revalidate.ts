import { countrySlug } from '@oathly/api/countries';
import { uiLocales } from '@oathly/i18n';
import { revalidatePath } from 'next/cache';

/**
 * Marks the public pages built from content as stale, in every language: the
 * landing page, the country list, and one country's page (or every
 * country's) with its topic pages. Each rebuilds on its next visit, so this
 * is cheap to call after any publish.
 *
 * revalidatePath takes a literal path with no type, or a route pattern with
 * one. A literal path with a type matches nothing. Pages live under
 * app/[locale], so English's are "/en/…" here even though visitors see them
 * without the prefix.
 */
export function revalidatePublicContent(isoCode?: string): string[] {
  revalidatePath('/api/public/countries');
  const paths = ['/', '/countries', '/api/public/countries'];
  revalidatePath('/[locale]', 'page');
  revalidatePath('/[locale]/countries', 'page');
  if (isoCode) {
    const path = `/countries/${countrySlug(isoCode)}`;
    for (const locale of uiLocales) revalidatePath(`/${locale}${path}`);
    paths.push(path);
  } else {
    revalidatePath('/[locale]/countries/[code]', 'page');
    paths.push('/countries/[code]');
  }
  // Topic pages are only addressable by pattern here; all of them go stale,
  // and each rebuilds only when someone next visits it.
  revalidatePath('/[locale]/countries/[code]/[topic]', 'page');
  paths.push('/countries/[code]/[topic]');
  return paths;
}
