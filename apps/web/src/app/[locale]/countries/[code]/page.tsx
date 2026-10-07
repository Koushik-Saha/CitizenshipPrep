import { testPath } from '@oathly/api/countries';
import { localizePath } from '@oathly/i18n';
import { notFound, permanentRedirect } from 'next/navigation';

import { getT } from '@/lib/i18n';
import { oldCountryParams, testPageFor } from '@/lib/old-country-urls';

// "/countries/us" was a country's page before "/united-states/citizenship-test".
// The old address answers with a permanent redirect, so links and search
// results that still carry it land on the new page.
export const revalidate = 3600;
export const dynamicParams = true;

export const generateStaticParams = oldCountryParams;

export default async function OldCountryPage({ params }: PageProps<'/[locale]/countries/[code]'>) {
  const { locale } = await getT(params);
  const page = await testPageFor((await params).code);
  if (!page) notFound();
  permanentRedirect(localizePath(locale, testPath(page.slug)));
}
