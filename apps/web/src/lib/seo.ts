import { localizePath, type UiLocale } from '@oathly/i18n';
import type { Metadata } from 'next';

import { alternates } from './i18n';

/** The size every preview image is drawn at: what social networks ask for. */
export const OG_SIZE = { width: 1200, height: 630 };

/** The address of a country's preview image (app/og/[image]/route.tsx). */
export const ogImagePath = (countrySlug: string) => `/og/${countrySlug}.png`;

/**
 * A public page's <head>: its title and description, its one address and the
 * same page in the other languages, and how a link to it looks when shared.
 * `path` is the page without a language prefix.
 */
export function shareMetadata(page: {
  locale: UiLocale;
  path: string;
  /** For the browser tab and search results. */
  title: string;
  /** For the shared link's card, which names the site separately. */
  heading: string;
  description: string;
  image: { countrySlug: string; alt: string };
}): Metadata {
  const images = [{ url: ogImagePath(page.image.countrySlug), ...OG_SIZE, alt: page.image.alt }];
  return {
    title: page.title,
    description: page.description,
    alternates: alternates(page.locale, page.path),
    openGraph: {
      type: 'website',
      siteName: 'Oathly',
      title: page.heading,
      description: page.description,
      url: localizePath(page.locale, page.path),
      locale: page.locale.replace('-', '_'),
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.heading,
      description: page.description,
      images,
    },
  };
}
