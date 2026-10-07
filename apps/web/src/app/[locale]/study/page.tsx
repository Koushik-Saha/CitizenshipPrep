import { nextStep } from '@oathly/api';
import { brandingMembership } from '@oathly/api/org';
import { queryKeys } from '@oathly/api/queries';
import { isOrgAdmin } from '@oathly/core';
import { isolate, localizePath } from '@oathly/i18n';
import { getDashboard, pendingInvitesFor } from '@oathly/api/server';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { join } from '@/app/[locale]/org/actions';
import { BRAND_CLASS, BrandStyle, OrgLogo } from '@/components/org/brand';
import { ProblemNotice } from '@/components/org/org-chrome';
import { DashboardView } from '@/components/study/dashboard-view';
import { buttonClass, focusRing, Notice } from '@/components/ui';
import { getDb } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { logoSrc } from '@/lib/org';
import { requireMe } from '@/lib/user';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/study'>): Promise<Metadata> {
  return { title: (await getT(params)).t('dashboard.metaTitle') };
}

// The server reads the dashboard and hands it to the client's query cache
// (see StudyProviders). The client draws from that cache, so later visits
// show it immediately and refresh in the background.
//
// A learner who studies with an organization sees its logo and colours here
// (white-label), and anyone invited to one is told so.
export default async function StudyDashboard({
  params,
  searchParams,
}: PageProps<'/[locale]/study'>) {
  const { locale, t } = await getT(params);
  const { user, me } = await requireMe(locale);
  if (nextStep(me) === 'onboarding') redirect(localizePath(locale, '/onboarding'));
  const dashboard = (await getDashboard(getDb(), user.userId))!;
  const timeZone =
    (
      await getDb().query<{ time_zone: string }>(
        'select time_zone from public.user_settings where user_id = $1',
        [user.userId],
      )
    ).rows[0]?.time_zone ?? 'UTC';

  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.dashboard, dashboard);

  const query = await searchParams;
  const branded = brandingMembership(me.organizations);
  const logo = branded && logoSrc({ id: branded.organizationId, brand: branded.brand });
  const studyingWith = me.organizations.filter((membership) => membership.role === 'member');
  const runs = me.organizations.filter((membership) => isOrgAdmin(membership.role));
  // Invitations sent to the address this person signed in with.
  const invites = await pendingInvitesFor(getDb(), user.email);
  const joined = me.organizations.find((membership) => membership.slug === query.joined);
  const link = `${focusRing} text-primary-fg rounded-xs font-medium underline underline-offset-4`;

  return (
    <div className={branded ? BRAND_CLASS : undefined}>
      {branded && <BrandStyle brand={branded.brand} />}
      {(studyingWith.length > 0 || runs.length > 0 || invites.length > 0 || query.error) && (
        <header className="mx-auto max-w-4xl space-y-4 px-4 pt-8" data-testid="org-strip">
          <ProblemNotice t={t} problem={query.error} />
          {joined && (
            <Notice tone="success" role="status">
              {t('org.joined', { organization: isolate(joined.name) })}
            </Notice>
          )}
          {invites.map((invite) => (
            <form
              key={invite.id}
              action={join}
              className="bg-primary-soft text-primary-fg flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3 text-sm"
            >
              <input type="hidden" name="inviteId" value={invite.id} />
              <p>
                {t('org.invitedBanner', { organization: isolate(invite.organization.name) })}{' '}
                {t('org.joinConsent', { organization: isolate(invite.organization.name) })}
              </p>
              <button type="submit" className={buttonClass.primary}>
                {t('org.viewInvitation')}
              </button>
            </form>
          ))}
          {(studyingWith.length > 0 || runs.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {logo && <OrgLogo src={logo} />}
              {studyingWith.length > 0 && (
                <p className="font-medium" data-testid="studying-with">
                  {t('org.studyingWith', {
                    organization: studyingWith
                      .map((membership) => isolate(membership.name))
                      .join(', '),
                  })}
                </p>
              )}
              <p className="ms-auto flex flex-wrap gap-x-4 text-sm">
                {runs.map((membership) => (
                  <Link
                    key={membership.organizationId}
                    href={localizePath(locale, `/org/${membership.slug}`)}
                    className={link}
                  >
                    {membership.name}
                  </Link>
                ))}
                {studyingWith.length > 0 && (
                  <Link href={localizePath(locale, '/org')} className={link}>
                    {t('org.title')}
                  </Link>
                )}
              </p>
            </div>
          )}
        </header>
      )}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DashboardView displayName={me.profile.displayName} timeZone={timeZone} />
      </HydrationBoundary>
    </div>
  );
}
