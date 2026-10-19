import { planSummary } from '@oathly/api/billing';
import { DISPLAY_NAME_MAX, storeSubscriptionsToCancel } from '@oathly/core';
import type { Metadata } from 'next';

import { I18nProvider } from '@/components/i18n/provider';
import Link from '@/components/link';
import { DeleteAccount } from '@/components/study/delete-account';
import { buttonClass, fieldClass, focusRing, labelClass, Notice } from '@/components/ui';
import { isAuthConfigured } from '@/lib/auth/server';
import { clientMessages, getT } from '@/lib/i18n';
import { requireMe } from '@/lib/user';

import { saveName, setAnalyticsChoice } from './actions';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/study/account'>): Promise<Metadata> {
  const { t } = await getT(params);
  return { title: `${t('common.account')} | Swornly`, robots: { index: false } };
}

// The learner's account: who they are signed in as, what they hold, and the
// way to delete it all.
export default async function AccountPage({
  params,
  searchParams,
}: PageProps<'/[locale]/study/account'>) {
  const { locale, t } = await getT(params);
  const { user, me } = await requireMe(locale);
  const said = (await searchParams).name;
  const nameNotice = said === 'saved' || said === 'problem' ? said : null;
  const optedOut = me.settings?.analyticsOptOut === true;
  const plan = planSummary(me, me.studyCountries);
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

      {nameNotice && (
        <div className="mt-6">
          <Notice
            tone={nameNotice === 'saved' ? 'success' : 'error'}
            role={nameNotice === 'saved' ? 'status' : 'alert'}
          >
            {t(nameNotice === 'saved' ? 'profile.nameSaved' : 'profile.nameProblem')}
          </Notice>
        </div>
      )}
      <form action={saveName} className="mt-8 max-w-md">
        <label htmlFor="displayName" className={labelClass}>
          {t('profile.nameLabel')}
        </label>
        <input
          id="displayName"
          name="displayName"
          defaultValue={me.profile.displayName ?? ''}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="nickname"
          dir="auto"
          aria-describedby="displayName-hint"
          className={fieldClass}
        />
        <p id="displayName-hint" className="text-fg-muted mt-1 text-sm">
          {t('profile.nameHint')}
        </p>
        <button type="submit" className={`${buttonClass.secondary} mt-3`}>
          {t('profile.nameSave')}
        </button>
      </form>

      <section aria-labelledby="your-data" className="mt-12">
        <h2 id="your-data" className="font-display text-2xl font-semibold">
          {t('profile.exportTitle')}
        </h2>
        <p className="text-fg-muted mt-2">{t('profile.exportBody')}</p>
        {/* A plain link to a file: the browser saves what the server sends. */}
        <a href="/api/me/export" download className={`${buttonClass.secondary} mt-4`}>
          {t('profile.exportButton')}
        </a>
      </section>

      <section aria-labelledby="statistics" className="mt-12">
        <h2 id="statistics" className="font-display text-2xl font-semibold">
          {t('profile.analyticsTitle')}
        </h2>
        <p className="text-fg-muted mt-2">{t('profile.analyticsBody')}</p>
        <form action={setAnalyticsChoice} className="mt-4">
          <input type="hidden" name="optOut" value={optedOut ? '0' : '1'} />
          {optedOut && (
            <p role="status" className="mb-3 font-medium">
              {t('profile.analyticsStopped')}
            </p>
          )}
          <button type="submit" className={buttonClass.secondary}>
            {t(optedOut ? 'profile.analyticsStart' : 'profile.analyticsStop')}
          </button>
        </form>
      </section>

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
