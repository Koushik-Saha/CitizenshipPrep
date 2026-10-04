import { countrySlug } from '@oathly/api/countries';
import { revalidatePath } from 'next/cache';

/**
 * Marks the public pages built from content as stale: the landing page, the
 * country list, and one country's page (or every country's) with its topic
 * pages. Each rebuilds on its next visit, so this is cheap to call after any
 * publish.
 *
 * revalidatePath takes a literal path with no type, or a route pattern with
 * one. A literal path with a type matches nothing.
 */
export function revalidatePublicContent(isoCode?: string): string[] {
  const paths = ['/', '/countries'];
  for (const path of paths) revalidatePath(path);
  if (isoCode) {
    const path = `/countries/${countrySlug(isoCode)}`;
    revalidatePath(path);
    paths.push(path);
  } else {
    revalidatePath('/countries/[code]', 'page');
    paths.push('/countries/[code]');
  }
  // Topic pages are only addressable by pattern here; all of them go stale,
  // and each rebuilds only when someone next visits it.
  revalidatePath('/countries/[code]/[topic]', 'page');
  paths.push('/countries/[code]/[topic]');
  return paths;
}
