// The frame the privacy policy, the terms and the account deletion page share.
// Their text is English in every language's address: a legal text is not
// something to machine-translate. Readers in another language are told so in
// their own.

import type { Translator } from '@oathly/i18n';

import { SiteFooter, SiteHeader } from '@/components/site-chrome';
import { focusRing } from '@/components/ui';
import { LEGAL_UPDATED, type Operator } from '@/lib/legal';

export const legalLink = `${focusRing} text-primary-fg rounded-xs underline underline-offset-4`;

export function LegalPage({
  t,
  path,
  title,
  dated = true,
  children,
}: {
  t: Translator;
  /** The page's path without a language prefix. */
  path: string;
  title: string;
  /** Whether to show when the text last changed. */
  dated?: boolean;
  children: React.ReactNode;
}) {
  const updated = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${LEGAL_UPDATED}T00:00:00Z`),
  );
  return (
    <>
      <SiteHeader t={t} path={path} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {t.locale !== 'en' && (
          <p className="bg-surface-sunken mb-6 rounded-md px-4 py-3 text-sm">
            {t('common.englishOnly')}
          </p>
        )}
        <article lang="en" dir="ltr" className="space-y-4">
          <h1 className="font-display text-4xl font-semibold">{title}</h1>
          {dated && (
            <p className="text-fg-muted text-sm">
              Last updated: <time dateTime={LEGAL_UPDATED}>{updated}</time>
            </p>
          )}
          {children}
        </article>
      </main>
      <SiteFooter t={t} />
    </>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pt-6">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 ps-6">{children}</ul>;
}

/** How to reach whoever runs the service, as much as has been set. */
export function Contact({ operator }: { operator: Operator }) {
  return (
    <p>
      {operator.name}
      {operator.address && <>, {operator.address}</>}
      {operator.email && (
        <>
          {' '}
          (
          <a href={`mailto:${operator.email}`} className={legalLink}>
            {operator.email}
          </a>
          )
        </>
      )}
      .
    </p>
  );
}
