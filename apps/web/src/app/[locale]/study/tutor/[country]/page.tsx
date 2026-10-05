import { countryName, localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import { focusRing } from '@/components/ui';
import { getT } from '@/lib/i18n';
import { requireMe } from '@/lib/user';

import { TutorChat } from './tutor-chat';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/study/tutor/[country]'>): Promise<Metadata> {
  return { title: (await getT(params)).t('tutor.metaTitle') };
}

export default async function TutorPage({ params }: PageProps<'/[locale]/study/tutor/[country]'>) {
  const { locale, t } = await getT(params);
  const { me } = await requireMe(locale);
  const code = (await params).country.toUpperCase();
  const country = me.studyCountries.find((candidate) => candidate.countryCode === code);
  if (!country) notFound();
  const name = countryName(country.countryCode, locale, country.countryName);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <p className="text-sm">
        <Link
          href={localizePath(t.locale, '/study')}
          prefetch
          className={`${focusRing} text-primary-fg rounded-xs underline`}
        >
          {t('common.backToStudy')}
        </Link>
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold">{t('tutor.title')}</h1>
      <p className="text-fg-muted mt-3">{t('tutor.intro', { country: name })}</p>
      <TutorChat countryCode={country.countryCode} countryName={name} />
    </main>
  );
}
