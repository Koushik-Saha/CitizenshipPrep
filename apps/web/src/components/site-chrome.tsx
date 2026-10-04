// Header and footer for the public pages. Server Components.

import Link from 'next/link';

import { LogoLockup } from '@/components/brand/logo';
import { focusRing } from '@/components/ui';

const navLink = `${focusRing} rounded-xs text-fg-muted hover:text-fg`;

export function SiteHeader() {
  return (
    <header className="border-border border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
        <Link href="/" className={`${focusRing} rounded-xs`}>
          <LogoLockup variant="meridian" layout="integrated" height={24} />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-6 text-sm font-medium">
          <Link href="/countries" className={navLink}>
            Countries
          </Link>
          <Link
            href="/sign-in"
            className={`${focusRing} text-fg rounded-xs underline-offset-4 hover:underline`}
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <div className="text-fg-muted mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 text-sm sm:flex-row sm:justify-between sm:px-6">
        <p>
          Oathly is an independent study app. It is not affiliated with, or endorsed by, any
          government.
        </p>
        <nav aria-label="Footer" className="flex gap-6">
          <Link href="/countries" className={navLink}>
            All countries
          </Link>
          <Link href="/sign-in" className={navLink}>
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/** "Countries / Canada / History" */
export function Breadcrumbs({ trail }: { trail: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-fg-muted text-sm">
      <ol className="flex flex-wrap items-center gap-2">
        {trail.map((step, i) => (
          <li key={step.label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {step.href ? (
              <Link href={step.href} className={`${navLink} underline-offset-4 hover:underline`}>
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
