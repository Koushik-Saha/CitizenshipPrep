import type { TestPages } from '@oathly/api/countries';
import { listTestPages } from '@oathly/api/server';
import { cache } from 'react';

import { getDb } from '@/lib/db';
import { loadPublic } from '@/lib/public-content';

// Country pages used to be addressed by ISO code ("/countries/us"). These map
// an old address to the country whose page it now is.

const loadPages = cache(() => listTestPages(getDb()));

/** The country an old two-letter address meant, or null. */
export async function testPageFor(code: string): Promise<TestPages | null> {
  if (!/^[a-z]{2}$/.test(code)) return null;
  const pages = await loadPages();
  return pages.find((page) => page.isoCode.toLowerCase() === code) ?? null;
}

/** For generateStaticParams: every old country address, with its topics'. */
export async function oldCountryParams(): Promise<{ code: string; topics: string[] }[]> {
  const pages = await loadPublic((db) => listTestPages(db), []);
  return pages.map((page) => ({
    code: page.isoCode.toLowerCase(),
    topics: page.topics.map((topic) => topic.slug),
  }));
}
