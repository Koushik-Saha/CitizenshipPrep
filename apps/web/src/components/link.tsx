'use client';

import { localizePath, splitLocalePath } from '@oathly/i18n/locales';
import NextLink from 'next/link';
import type { ComponentProps } from 'react';

import { useLocale } from '@/components/i18n/locale';

/**
 * next/link that stays in the page's language: href="/countries" goes to
 * "/es/countries" on a Spanish page. For Client Components; a Server
 * Component knows its language and passes next/link a localised href itself
 * (localizePath), which keeps this wrapper out of pages that do not need it.
 */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  // An address that already names its language is left as it is: a Server
  // Component may have localised it before handing it over.
  const localized =
    typeof href === 'string' && href.startsWith('/') && !splitLocalePath(href).locale
      ? localizePath(locale, href)
      : href;
  return <NextLink href={localized} {...props} />;
}
