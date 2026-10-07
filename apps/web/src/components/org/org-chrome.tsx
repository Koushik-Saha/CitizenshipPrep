import type { Organization } from '@oathly/api/org';
import { localizePath, type Translator } from '@oathly/i18n';
import Link from 'next/link';

import { LanguageMenu } from '@/components/i18n/language-menu';
import { focusRing, Notice } from '@/components/ui';
import { logoSrc } from '@/lib/org';

import { OrgLogo } from './brand';

const link = `${focusRing} text-primary-fg rounded-xs underline underline-offset-4`;

/** The top of every page of an organization's console: where you are, and the way between its parts. */
export function OrgHeader({
  t,
  organization,
  current,
}: {
  t: Translator;
  organization: Organization;
  current: 'learners' | 'invite' | 'settings';
}) {
  const base = `/org/${organization.slug}`;
  const tabs = [
    { id: 'learners', href: base, label: t('org.learners') },
    { id: 'invite', href: `${base}/invite`, label: t('org.invite') },
    { id: 'settings', href: `${base}/settings`, label: t('org.settings') },
  ] as const;
  const logo = logoSrc(organization);
  const path = tabs.find((tab) => tab.id === current)!.href;
  return (
    <header>
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href={localizePath(t.locale, '/org')} prefetch className={link}>
            {t('org.allOrganizations')}
          </Link>
          <Link href={localizePath(t.locale, '/study')} className={link}>
            {t('common.backToStudy')}
          </Link>
        </p>
        <div className="font-medium">
          <LanguageMenu locale={t.locale} label={t('common.language')} path={path} />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {logo && <OrgLogo src={logo} className="h-12" />}
        <h1 className="font-display text-4xl font-semibold">{organization.name}</h1>
      </div>
      <nav aria-label={organization.name} className="border-border mt-6 border-b">
        <ul className="-mb-px flex flex-wrap gap-x-6">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <Link
                href={localizePath(t.locale, tab.href)}
                prefetch
                aria-current={tab.id === current ? 'page' : undefined}
                className={`${focusRing} inline-block rounded-xs border-b-2 px-1 py-3 font-medium ${
                  tab.id === current
                    ? 'border-primary text-fg'
                    : 'text-fg-muted hover:text-fg border-transparent'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

const problemMessage = {
  'not-found': 'org.errorNotFound',
  forbidden: 'org.errorForbidden',
  invalid: 'org.errorInvalid',
  'invite-gone': 'org.errorInviteGone',
  'wrong-address': 'org.errorWrongAddress',
  'bad-logo': 'org.errorBadLogo',
} as const;

/** What to say about a refusal named in the query string; null for anything unrecognised. */
export function problemText(t: Translator, problem: unknown): string | null {
  return typeof problem === 'string' && problem in problemMessage
    ? t(problemMessage[problem as keyof typeof problemMessage])
    : null;
}

/** The notice for `?error=…`, if there is one to show. */
export function ProblemNotice({ t, problem }: { t: Translator; problem: unknown }) {
  const text = problemText(t, problem);
  return text ? (
    <div className="mt-6">
      <Notice tone="error" role="alert">
        {text}
      </Notice>
    </div>
  ) : null;
}
