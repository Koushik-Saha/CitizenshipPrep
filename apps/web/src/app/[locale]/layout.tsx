import { textDirection } from '@oathly/i18n';
import type { Metadata } from 'next';

import { SceneHost } from '@/components/globe/scene-host';
import { I18nProvider } from '@/components/i18n/locale';
import { RouteFade } from '@/components/route-fade';
import { fontVariables } from '@/lib/fonts';
import { clientMessages, getT, localeParams } from '@/lib/i18n';

import '../globals.css';

// One prerendered copy of each static page per language.
export const generateStaticParams = localeParams;

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { t } = await getT(params);
  return {
    title: 'Oathly',
    description: t('common.notAffiliated'),
    // Makes the per-language links in each page's <head> absolute.
    metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await getT(params);
  return (
    <html lang={locale} dir={textDirection(locale)} className={fontVariables}>
      <body className="bg-canvas text-fg font-sans antialiased">
        {/* What Client Components on every page need; sections add their own. */}
        <I18nProvider locale={locale} messages={clientMessages(locale, ['common', 'exam'])}>
          {/* Page changes cross-fade: View Transitions API, or Motion without it. */}
          <RouteFade>{children}</RouteFade>
          {/* The app's one WebGL canvas, shared by every page that shows the globe. */}
          <SceneHost />
        </I18nProvider>
      </body>
    </html>
  );
}
