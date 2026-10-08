import { localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { buttonClass } from '@/components/ui';
import { getT } from '@/lib/i18n';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/account-deleted'>): Promise<Metadata> {
  const { t } = await getT(params);
  return { title: `${t('profile.deletedTitle')} | Oathly`, robots: { index: false } };
}

// Where the website lands after an account has been deleted.
export default async function AccountDeletedPage({
  params,
}: PageProps<'/[locale]/account-deleted'>) {
  const { locale, t } = await getT(params);
  return (
    <>
      <SiteHeader t={t} path="/account-deleted" />
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold">{t('profile.deletedTitle')}</h1>
        <p className="text-fg-muted mt-4">{t('profile.deletedBody')}</p>
        <Link href={localizePath(locale, '/')} className={`${buttonClass.secondary} mt-8`}>
          {t('common.backHome')}
        </Link>
      </main>
      <SiteFooter t={t} />
    </>
  );
}
