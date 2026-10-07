import { testPath } from '@oathly/api/countries';
import { localizePath } from '@oathly/i18n';
import { notFound, permanentRedirect } from 'next/navigation';

import { getT } from '@/lib/i18n';
import { oldCountryParams, testPageFor } from '@/lib/old-country-urls';

// "/countries/us/history" was a topic's page before
// "/united-states/citizenship-test/history": see ../page.tsx.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const pages = await oldCountryParams();
  return pages.flatMap((page) => page.topics.map((topic) => ({ code: page.code, topic })));
}

export default async function OldTopicPage({
  params,
}: PageProps<'/[locale]/countries/[code]/[topic]'>) {
  const { locale } = await getT(params);
  const { code, topic } = await params;
  const page = await testPageFor(code);
  if (!page || !page.topics.some((candidate) => candidate.slug === topic)) notFound();
  permanentRedirect(localizePath(locale, testPath(page.slug, topic)));
}
