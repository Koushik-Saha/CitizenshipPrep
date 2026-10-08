import { planSummary } from '@oathly/api/billing';
import { storeSubscriptionsToCancel } from '@oathly/core';
import type { Metadata } from 'next';

import { I18nProvider } from '@/components/i18n/provider';
import Link from '@/components/link';
import { DeleteAccount } from '@/components/study/delete-account';
import { focusRing } from '@/components/ui';
import { isAuthConfigured } from '@/lib/auth/server';
import { clientMessages, getT } from '@/lib/i18n';
import { requireMe } from '@/lib/user';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/study/account'>): Promise<Metadata> {
  const { t } = await getT(params);
  return { title: `${t('common.account')} | Oathly`, robots: { index: false } };
}

// The learner's account: who they are signed in as, what they hold, and the
// way to delete it all.
export default async function AccountPage({ params }: PageProps<'/[locale]/study/account'>) {
  const { locale, t } = await getT(params);
  const { user, me } = await requireMe(locale);
  const plan = planSummary(
    me,
    me.studyCountries.map((country) => country.countryCode),
  );
  // What renews until cancelled: everything in force but a one-off pass.
  const renewing = me.entitlements
    .filter(
      (held) => held.status !== 'expired' && held.status !== 'canceled' && !held.cancelAtPeriodEnd,
    )
    .map((held) => ({
      provider: held.provider,
      plan: held.plan,
      renews: held.plan !== 'country_pass',
    }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-sm">
        <Link
          href="/study"
          prefetch
          className={`${focusRing} text-fg-muted hover:text-fg rounded-xs underline-offset-4 hover:underline`}
        >
          {t('common.backToStudy')}
        </Link>
      </p>
      <h1 className="font-display mt-4 text-4xl font-semibold">{t('common.account')}</h1>
      <dl className="mt-6 space-y-2">
        {me.profile.displayName && (
          <div>
            <dt className="sr-only">{t('profile.title')}</dt>
            <dd className="text-lg font-medium">{me.profile.displayName}</dd>
          </div>
        )}
        {user.email && (
          <div>
            <dt className="sr-only">{t('auth.email')}</dt>
            <dd className="text-fg-muted">
              <bdi>{user.email}</bdi>
            </dd>
          </div>
        )}
        <div>
          <dt className="sr-only">{t('plans.title')}</dt>
          <dd>
            <Link
              href="/study/plans"
              prefetch
              className={`${focusRing} text-primary-fg rounded-xs font-medium underline underline-offset-4`}
            >
              {t('plans.title')}
              {plan.pro ? `: ${t('plans.pro')}` : ''}
            </Link>
          </dd>
        </div>
      </dl>

      <I18nProvider locale={locale} messages={clientMessages(locale, ['profile'])}>
        <DeleteAccount
          stores={storeSubscriptionsToCancel(renewing).length > 0}
          hasWebSubscription={renewing.some((held) => held.provider === 'stripe' && held.renews)}
          signInConfigured={isAuthConfigured()}
        />
      </I18nProvider>
    </main>
  );
}
