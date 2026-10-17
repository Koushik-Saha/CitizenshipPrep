import { testPath } from '@oathly/api/countries';
import { getTestGuide, listTestPages } from '@oathly/api/server';
import { TRIAL_QUESTIONS } from '@oathly/core';
import { countryName, localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { I18nProvider } from '@/components/i18n/provider';
import { Breadcrumbs, SiteFooter, SiteHeader } from '@/components/site-chrome';
import { GuestTrial } from '@/components/trial/guest-trial';
import { clientMessages, getT } from '@/lib/i18n';
import { getDb } from '@/lib/db';
import { loadPublic } from '@/lib/public-content';

// "/canada/citizenship-test/try": a round of real practice for anyone, no
// account needed. The questions are the first of the country's public samples
// (the same ones its test page shows), so nothing here is held back from
// visitors elsewhere. Static like the test page, and rebuilt with it.
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const pages = await loadPublic((db) => listTestPages(db), []);
  return pages.map((page) => ({ country: page.slug }));
}

const loadGuide = cache((slug: string, locale: string) =>
  /^[a-z0-9-]{4,80}$/.test(slug)
    ? getTestGuide(getDb(), slug, locale, TRIAL_QUESTIONS)
    : Promise.resolve(null),
);

type Props = PageProps<'/[locale]/[country]/citizenship-test/try'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, t } = await getT(params);
  const guide = await loadGuide((await params).country, locale);
  if (!guide) return {};
  const country = countryName(guide.isoCode, locale, guide.name);
  return {
    title: t('trial.metaTitle', { country, count: TRIAL_QUESTIONS }),
    description: t('trial.intro', { count: TRIAL_QUESTIONS }),
    // The questions are on the test page already; that is the one to find.
    robots: { index: false, follow: true },
  };
}

export default async function TrialPage({ params }: Props) {
  const { locale, t } = await getT(params);
  const guide = await loadGuide((await params).country, locale);
  if (!guide || guide.questions.length === 0) notFound();
  const country = countryName(guide.isoCode, locale, guide.name);
  const testPage = testPath(guide.slug);
  const title = t('trial.title', { country });

  return (
    <>
      <SiteHeader t={t} path={`${testPage}/try`} />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Breadcrumbs
          t={t}
          trail={[
            { href: '/countries', label: t('common.countries') },
            { href: testPage, label: t('countries.countryTitle', { country }) },
            { label: title },
          ]}
        />
        <h1 className="font-display mt-4 text-3xl font-semibold text-balance sm:text-4xl">
          {title}
        </h1>
        <p className="text-fg-muted mt-3">{t('trial.intro', { count: guide.questions.length })}</p>
        <I18nProvider
          locale={locale}
          messages={clientMessages(locale, ['trial', 'session', 'common'])}
        >
          <GuestTrial
            questions={guide.questions.map(
              ({ id, type, topic, locale: wording, text, options, correctKeys, explanation }) => ({
                id,
                type,
                topic,
                locale: wording,
                text,
                options,
                correctKeys,
                explanation,
              }),
            )}
            signUpHref={localizePath(locale, `/sign-in?country=${guide.isoCode}`)}
            backHref={localizePath(locale, testPage)}
            backLabel={t('trial.back', { country })}
          />
        </I18nProvider>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
