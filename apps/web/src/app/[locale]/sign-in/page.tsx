import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ContinueIfSignedIn, SignInForm } from '@/components/auth/sign-in-form';
import { I18nProvider } from '@/components/i18n/provider';
import { LanguageMenu } from '@/components/i18n/language-menu';
import { Notice } from '@/components/ui';
import { isAuthConfigured } from '@/lib/auth/server';
import { alternates, clientMessages, getT } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/sign-in'>): Promise<Metadata> {
  const { locale, t } = await getT(params);
  return { title: t('auth.metaTitle'), alternates: alternates(locale, '/sign-in') };
}

// Static, so links to it prefetch the whole page and it opens at once.
// Rebuilt every minute so a change to the auth configuration shows up.
export const revalidate = 60;

export default async function SignInPage({ params }: PageProps<'/[locale]/sign-in'>) {
  const { locale, t } = await getT(params);
  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <Suspense>
        <ContinueIfSignedIn />
      </Suspense>
      <div className="mb-8 flex justify-end text-sm font-medium">
        <LanguageMenu locale={locale} label={t('common.language')} path="/sign-in" />
      </div>
      <h1 className="font-display text-4xl font-semibold">{t('auth.title')}</h1>
      <p className="text-fg-muted mt-3">{t('auth.intro')}</p>
      <div className="mt-8">
        {isAuthConfigured() ? (
          // The form reads ?country= from the URL, which only the browser knows.
          <Suspense fallback={<div className="h-56" aria-hidden="true" />}>
            <I18nProvider locale={locale} messages={clientMessages(locale, ['auth'])}>
              <SignInForm />
            </I18nProvider>
          </Suspense>
        ) : (
          <Notice tone="warning">{t('auth.notConfigured')}</Notice>
        )}
      </div>
      <p className="text-fg-muted mt-10 text-sm">{t('common.notAffiliated')}</p>
    </main>
  );
}
