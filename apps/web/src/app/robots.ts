import { localizePath, uiLocales } from '@oathly/i18n';
import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

// What a signed-out visitor cannot see is not worth a crawler's visit: every
// one of these answers with a redirect to sign-in. Each has an address per
// language.
const privatePaths = ['/study', '/onboarding', '/welcome', '/org', '/join'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        ...uiLocales.flatMap((locale) => privatePaths.map((path) => localizePath(locale, path))),
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
