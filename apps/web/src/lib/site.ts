// Where the site lives, for the addresses search engines are given: canonical
// links, the per-language alternates, the sitemap and the preview images.

/**
 * The site's origin, without a trailing slash. Set SITE_URL on the host to
 * the public address; the pages are built ahead of time, so it is read at
 * build time. Without it (a laptop, CI) addresses point at the local server,
 * which is what a check run against that server wants.
 */
export function siteUrl(): string {
  const set = process.env.SITE_URL?.trim().replace(/\/+$/, '');
  if (set) return set;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/** An absolute address for a path on the site. */
export const absoluteUrl = (path: string) => siteUrl() + (path === '/' ? '' : path);
