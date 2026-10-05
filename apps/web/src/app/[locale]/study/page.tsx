import { nextStep } from '@oathly/api';
import { queryKeys } from '@oathly/api/queries';
import { localizePath } from '@oathly/i18n';
import { getDashboard } from '@oathly/api/server';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DashboardView } from '@/components/study/dashboard-view';
import { getDb } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { requireMe } from '@/lib/user';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/study'>): Promise<Metadata> {
  return { title: (await getT(params)).t('dashboard.metaTitle') };
}

// The server reads the dashboard and hands it to the client's query cache
// (see StudyProviders). The client draws from that cache, so later visits
// show it immediately and refresh in the background.
export default async function StudyDashboard({ params }: PageProps<'/[locale]/study'>) {
  const { locale } = await getT(params);
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

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardView displayName={me.profile.displayName} timeZone={timeZone} />
    </HydrationBoundary>
  );
}
