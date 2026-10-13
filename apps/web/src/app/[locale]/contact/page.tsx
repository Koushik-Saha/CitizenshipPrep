import type { Metadata } from 'next';

import { I18nProvider } from '@/components/i18n/provider';
import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { focusRing } from '@/components/ui';
import { alternates, clientMessages, getT } from '@/lib/i18n';
import { isSupportFormOpen, supportAddress } from '@/lib/support';

import { ContactForm } from './contact-form';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const { locale, t } = await getT(params);
  return {
    title: t('contact.metaTitle'),
    description: t('contact.intro'),
    alternates: alternates(locale, '/contact'),
  };
}

// How to reach support, for anyone, signed in or not. The form emails the
// support address; where email is not set up on this server, the page gives
// the address instead of a form that could not deliver.
export default async function ContactPage({ params }: PageProps<'/[locale]/contact'>) {
  const { locale, t } = await getT(params);
  const address = supportAddress();
  const open = isSupportFormOpen();
  // The sentence around the address, so the address itself can be a link.
  const SLOT = '\uE000';
  const [before, after] = t('contact.direct', { email: SLOT }).split(SLOT);
  return (
    <>
      <SiteHeader t={t} path="/contact" />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">{t('contact.title')}</h1>
        <p className="text-fg-muted mt-4 text-lg">{t('contact.intro')}</p>
        <p className="text-fg-muted mt-2">{t('contact.notAdvice')}</p>
        <div className="mt-10">
          {open ? (
            <I18nProvider locale={locale} messages={clientMessages(locale, ['contact'])}>
              <ContactForm />
            </I18nProvider>
          ) : (
            !address && <p className="text-fg-muted">{t('contact.unavailable')}</p>
          )}
        </div>
        {address && (
          <p className={open ? 'text-fg-muted mt-8 text-sm' : 'text-lg'}>
            {before}
            <a
              href={`mailto:${address}`}
              className={`${focusRing} text-primary-fg rounded-xs underline underline-offset-4`}
            >
              <bdi>{address}</bdi>
            </a>
            {after}
          </p>
        )}
      </main>
      <SiteFooter t={t} />
    </>
  );
}
