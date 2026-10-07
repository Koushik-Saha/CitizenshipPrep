import { findInvite } from '@oathly/api/server';
import { countryName, isolate, localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BRAND_CLASS, BrandStyle, OrgLogo } from '@/components/org/brand';
import { ProblemNotice } from '@/components/org/org-chrome';
import { buttonClass, Notice } from '@/components/ui';
import { getDb } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { logoSrc } from '@/lib/org';
import { currentUser } from '@/lib/user';

import { join } from '../../org/actions';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/join/[token]'>): Promise<Metadata> {
  // The address carries the invitation: keep it out of search engines and referrers.
  return {
    title: (await getT(params)).t('org.metaTitle'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

// An invitation to an organization: who is inviting, to what, and what
// joining means for the person's privacy, before they accept.
export default async function JoinPage({
  params,
  searchParams,
}: PageProps<'/[locale]/join/[token]'>) {
  const { locale, t } = await getT(params);
  const { token } = await params;
  const invite = await findInvite(getDb(), token);
  const user = await currentUser();
  const problem = (await searchParams).error;

  if (!invite || invite.expired) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 sm:py-16">
        <Notice tone="warning" role="alert">
          {t('org.errorInviteGone')}
        </Notice>
        <p className="mt-6">
          <Link href={localizePath(locale, '/')} className={buttonClass.secondary}>
            Oathly
          </Link>
        </p>
      </main>
    );
  }

  const organization = isolate(invite.organization.name);
  const logo = logoSrc(invite.organization);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' });
  const learner = invite.role === 'member';

  return (
    <main className={`${BRAND_CLASS} mx-auto max-w-xl px-4 py-12 sm:py-16`}>
      <BrandStyle brand={invite.organization.brand} />
      {logo && <OrgLogo src={logo} className="mb-6 h-14" />}
      <h1 className="font-display text-4xl font-semibold">
        {t('org.joinTitle', { organization })}
      </h1>
      <ProblemNotice t={t} problem={problem} />

      <div className="mt-6 space-y-3">
        <p>{t(learner ? 'org.joinInvited' : 'org.joinInvitedAdmin', { organization })}</p>
        {learner && invite.countryCode && (
          <p>
            {t('org.joinAssigned', {
              country: countryName(invite.countryCode, locale, invite.countryName ?? ''),
            })}{' '}
            {invite.targetDate &&
              t('org.joinTarget', {
                date: date.format(new Date(`${invite.targetDate}T00:00:00Z`)),
              })}
          </p>
        )}
        {learner && <p>{t('org.joinIncludes')}</p>}
      </div>

      {learner && (
        <div className="mt-6">
          <Notice tone="neutral">{t('org.joinConsent', { organization })}</Notice>
        </div>
      )}

      <div className="mt-8">
        {user ? (
          <form action={join}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className={buttonClass.primary}>
              {t('org.joinButton')}
            </button>
          </form>
        ) : (
          <Link
            href={localizePath(locale, `/sign-in?join=${encodeURIComponent(token)}`)}
            className={buttonClass.primary}
          >
            {t('org.joinSignIn')}
          </Link>
        )}
      </div>

      <p className="text-fg-muted mt-10 text-sm">{t('common.notAffiliated')}</p>
    </main>
  );
}
