// What search engines read from a public page besides its text: structured
// data and a sitemap. Pure: the apps supply the words and the addresses.

/** A question and its answer, as shown in a page's FAQ. */
export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Text as a search engine should read it: without the invisible marks that
 * keep a name in another script reading the right way inside a sentence.
 */
const plain = (text: string) => text.replace(/[\u2066-\u2069]/g, '');

/**
 * schema.org FAQPage for the questions a page shows. Only mark up what the
 * reader can see on the page, word for word.
 */
export function faqPageSchema(items: readonly FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: plain(item.question),
      acceptedAnswer: { '@type': 'Answer', text: plain(item.answer) },
    })),
  };
}

/** schema.org BreadcrumbList: where a page sits, outermost first, with absolute addresses. */
export function breadcrumbSchema(trail: readonly { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: plain(step.name),
      item: step.url,
    })),
  };
}

/**
 * Structured data as the body of a <script type="application/ld+json">. JSON
 * alone is not safe there: text containing "</script>" would end the element,
 * so the characters HTML reads are written as escapes, which JSON reads back
 * unchanged.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** A pass mark as a whole percentage of the questions asked; null when either is not fixed. */
export function passPercent(passMark: number | null, questionCount: number | null): number | null {
  if (passMark === null || questionCount === null || questionCount <= 0) return null;
  return Math.round((passMark / questionCount) * 100);
}

/** The latest of some ISO dates, or null when there are none. */
export function latestDate(dates: readonly (string | null | undefined)[]): string | null {
  let latest: string | null = null;
  for (const date of dates) {
    if (!date) continue;
    if (latest === null || Date.parse(date) > Date.parse(latest)) latest = date;
  }
  return latest;
}

/** One page of the site, without a language: its path and when its content last changed. */
export interface SitePage {
  path: string;
  lastModified: string | null;
}

export interface SitemapEntry {
  url: string;
  lastModified: string | null;
  /** The same page in every language, by language tag, plus "x-default". */
  languages: Record<string, string>;
}

/**
 * A sitemap with one entry per page per language, each naming all of the
 * page's languages (search engines want the full set on every one of them).
 * `localize` turns a page's path into its path in a language.
 */
export function sitemapEntries(
  pages: readonly SitePage[],
  options: {
    origin: string;
    locales: readonly string[];
    defaultLocale: string;
    localize: (locale: string, path: string) => string;
  },
): SitemapEntry[] {
  const origin = options.origin.replace(/\/+$/, '');
  const address = (locale: string, path: string) => {
    const localized = options.localize(locale, path);
    return origin + (localized === '/' ? '' : localized);
  };
  return pages.flatMap((page) => {
    const languages: Record<string, string> = Object.fromEntries(
      options.locales.map((locale) => [locale, address(locale, page.path)]),
    );
    languages['x-default'] = address(options.defaultLocale, page.path);
    return options.locales.map((locale) => ({
      url: address(locale, page.path),
      lastModified: page.lastModified,
      languages,
    }));
  });
}
