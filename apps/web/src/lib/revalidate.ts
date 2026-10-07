import { testPath } from '@oathly/api/countries';
import { uiLocales } from '@oathly/i18n';
import { revalidatePath } from 'next/cache';

import { ogImagePath } from '@/lib/seo';

/**
 * Marks the public pages built from content as stale, in every language: the
 * landing page, the country list, the sitemap, and one country's test page
 * (or every country's) with its topic pages and preview image. Each rebuilds
 * on its next visit, so this is cheap to call after any publish. A country's
 * pages are addressed by its slug.
 *
 * revalidatePath takes a literal path with no type, or a route pattern with
 * one. A literal path with a type matches nothing. Pages live under
 * app/[locale], so English's are "/en/…" here even though visitors see them
 * without the prefix.
 */
export function revalidatePublicContent(countrySlug?: string): string[] {
  revalidatePath('/api/public/countries');
  revalidatePath('/sitemap.xml');
  const paths = ['/', '/countries', '/api/public/countries', '/sitemap.xml'];
  revalidatePath('/[locale]', 'page');
  revalidatePath('/[locale]/countries', 'page');

  if (countrySlug) {
    const path = testPath(countrySlug);
    for (const locale of uiLocales) revalidatePath(`/${locale}${path}`);
    revalidatePath(ogImagePath(countrySlug));
    paths.push(path, ogImagePath(countrySlug));
  } else {
    revalidatePath('/[locale]/[country]/citizenship-test', 'page');
    revalidatePath('/og/[image]', 'page');
    paths.push(testPath('[country]'), ogImagePath('[country]'));
  }
  // Topic pages are only addressable by pattern here; all of them go stale,
  // and each rebuilds only when someone next visits it. The same goes for the
  // old "/countries/…" addresses that redirect to them.
  revalidatePath('/[locale]/[country]/citizenship-test/[topic]', 'page');
  revalidatePath('/[locale]/countries/[code]', 'page');
  revalidatePath('/[locale]/countries/[code]/[topic]', 'page');
  paths.push(testPath('[country]', '[topic]'));
  return paths;
}
