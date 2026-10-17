// Header and footer for the public pages. Server Components.

import { localizePath, type Translator } from '@oathly/i18n';
import Link from 'next/link';

import { LogoLockup } from '@/components/brand/logo';
import { LanguageMenu } from '@/components/i18n/language-menu';
import { focusRing } from '@/components/ui';

// min-h-11: each link is 44px tall, an easy target on a phone.
const navLink = `${focusRing} inline-flex min-h-11 items-center rounded-xs text-fg-muted hover:text-fg`;

export function SiteHeader({
  t,
  path,
}: {
  t: Translator;
  /** The page's path without a language prefix, for the language menu. */
  path: string;
}) {
  return (
    <header className="border-border border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-2 sm:px-6">
        <Link
          href={localizePath(t.locale, '/')}
          className={`${focusRing} inline-flex min-h-11 items-center rounded-xs`}
        >
          <LogoLockup variant="meridian" layout="integrated" height={24} />
        </Link>
        <nav
          aria-label={t('common.mainNav')}
          className="flex items-center gap-4 text-sm font-medium sm:gap-6"
        >
          <Link href={localizePath(t.locale, '/countries')} className={navLink}>
            {t('common.countries')}
          </Link>
          <LanguageMenu locale={t.locale} label={t('common.language')} path={path} />
          <Link
            href={localizePath(t.locale, '/sign-in')}
            className={`${focusRing} text-fg inline-flex min-h-11 items-center rounded-xs underline-offset-4 hover:underline`}
          >
            {t('common.signIn')}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter({ t }: { t: Translator }) {
  return (
    <footer className="border-border border-t">
      <div className="text-fg-muted mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 text-sm sm:flex-row sm:justify-between sm:px-6">
        <p>{t('common.notAffiliated')}</p>
        <nav aria-label={t('common.footerNav')} className="flex shrink-0 flex-wrap gap-x-6">
          <Link href={localizePath(t.locale, '/countries')} className={navLink}>
            {t('common.allCountries')}
          </Link>
          {/* Rarely followed: nothing to prefetch. */}
          <Link href={localizePath(t.locale, '/org')} prefetch={false} className={navLink}>
            {t('org.forOrganizations')}
          </Link>
          <Link href={localizePath(t.locale, '/sign-in')} className={navLink}>
            {t('common.signIn')}
          </Link>
          {/* Rarely followed: nothing to prefetch. */}
          <Link href={localizePath(t.locale, '/contact')} prefetch={false} className={navLink}>
            {t('common.contact')}
          </Link>
          <Link href={localizePath(t.locale, '/privacy')} prefetch={false} className={navLink}>
            {t('common.privacy')}
          </Link>
          <Link href={localizePath(t.locale, '/terms')} prefetch={false} className={navLink}>
            {t('common.terms')}
          </Link>
          <Link href={localizePath(t.locale, '/refunds')} prefetch={false} className={navLink}>
            {t('common.refunds')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/**
 * The footer of the signed-in pages: that Oathly is not a government's, and
 * the pages about the service. Wherever answers and a readiness estimate are
 * shown, this is underneath.
 */
export function LegalFooter({ t }: { t: Translator }) {
  const pages = [
    ['/terms', 'common.terms'],
    ['/privacy', 'common.privacy'],
    ['/refunds', 'common.refunds'],
    ['/contact', 'common.contact'],
  ] as const;
  return (
    <footer className="border-border mt-10 border-t">
      <div className="text-fg-muted mx-auto flex max-w-3xl flex-col gap-3 px-4 py-8 text-sm">
        <p>{t('common.notAffiliated')}</p>
        <nav aria-label={t('common.footerNav')} className="flex flex-wrap gap-x-6">
          {pages.map(([path, label]) => (
            <Link
              key={path}
              href={localizePath(t.locale, path)}
              prefetch={false}
              className={navLink}
            >
              {t(label)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

/** "Countries / Canada / History" */
export function Breadcrumbs({
  trail,
  t,
}: {
  trail: { href?: string; label: string }[];
  t: Translator;
}) {
  return (
    <nav aria-label={t('common.breadcrumb')} className="text-fg-muted text-sm">
      <ol className="flex flex-wrap items-center gap-2">
        {trail.map((step, i) => (
          <li key={step.label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {step.href ? (
              <Link
                href={localizePath(t.locale, step.href)}
                className={`${navLink} underline-offset-4 hover:underline`}
              >
                {step.label}
              </Link>
            ) : (
              <span aria-current="page">{step.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
