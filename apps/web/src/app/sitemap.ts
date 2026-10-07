import { publicSitePages } from '@oathly/api/seo';
import { listTestPages } from '@oathly/api/server';
import { sitemapEntries } from '@oathly/core';
import { defaultLocale, localizePath, uiLocales, type UiLocale } from '@oathly/i18n';
import type { MetadataRoute } from 'next';

import { loadPublic } from '@/lib/public-content';
import { siteUrl } from '@/lib/site';

// Every public page in every language, each naming its translations. Built
// with the pages and refreshed with them when content is published
// (lib/revalidate.ts).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await loadPublic((db) => listTestPages(db), []);
  return sitemapEntries(publicSitePages(pages), {
    origin: siteUrl(),
    locales: uiLocales,
    defaultLocale,
    localize: (locale, path) => localizePath(locale as UiLocale, path),
  }).map((entry) => ({
    url: entry.url,
    ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
    alternates: { languages: entry.languages },
  }));
}
