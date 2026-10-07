import { formatPrice, planSummary, type PlanPrice } from '@oathly/api/billing';
import { aiLimits, FREE_QUESTIONS_PER_COUNTRY } from '@oathly/core';
import { countryName, localizePath, type Translator } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PlanRefresher } from '@/components/study/plan-refresher';
import { buttonClass, focusRing, Notice } from '@/components/ui';
import { isBillingConfigured, planPrices } from '@/lib/billing';
import { getT } from '@/lib/i18n';
import { requireMe } from '@/lib/user';

import { openBillingPortal, startCheckout } from './actions';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/study/plans'>): Promise<Metadata> {
  return { title: (await getT(params)).t('plans.metaTitle') };
}

/** Where each kind of purchase is managed, by its proper name. */
const storeName = { app_store: 'App Store', play_store: 'Google Play' } as const;

function price(
  t: Translator,
  prices: readonly PlanPrice[],
  plan: PlanPrice['plan'],
  message: 'plans.perMonth' | 'plans.perYear' | 'plans.once',
): string | null {
  const found = prices.find((candidate) => candidate.plan === plan);
  return found ? t(message, { price: formatPrice(found, t.locale) }) : null;
}

// What the learner holds, and what they can buy. Buying happens on a page
// hosted by Stripe; this page only starts it and shows the result.
export default async function PlansPage({
  params,
  searchParams,
}: PageProps<'/[locale]/study/plans'>) {
  const { locale, t } = await getT(params);
  const { me } = await requireMe(locale);
  const summary = planSummary(
    me,
    me.studyCountries.map((country) => country.countryCode),
  );
  const prices = await planPrices();
  const canBuy = isBillingConfigured();
  const justBought = (await searchParams).purchase === 'done';
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'long' });
  const nameOf = (code: string) =>
    countryName(
      code,
      locale,
      me.studyCountries.find((country) => country.countryCode === code)?.countryName ?? code,
    );
  const ai = (allowance: 'free' | 'pro') =>
    t('landing.planAiAllowance', {
      explanations: aiLimits[allowance].explanation,
      messages: aiLimits[allowance].tutor,
    });
  const card = 'bg-surface border-border rounded-lg border p-5 sm:p-6';
  const { pro } = summary;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      {justBought && <PlanRefresher />}
      <p className="text-sm">
        <Link
          href={localizePath(locale, '/study')}
          prefetch
          className={`${focusRing} text-primary-fg rounded-xs underline`}
        >
          {t('common.backToStudy')}
        </Link>
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold">{t('plans.title')}</h1>
      {justBought && (
        <div className="mt-6">
          <Notice tone="success" role="status">
            {t('plans.thanks')}
          </Notice>
        </div>
      )}

      <section aria-labelledby="your-plan" className={`${card} mt-8`}>
        <h2 id="your-plan" className="text-fg-muted text-sm font-medium">
          {t('plans.yourPlan')}
        </h2>
        <p className="font-display mt-1 text-2xl font-semibold" data-testid="current-plan">
          {pro ? t('plans.pro') : t('plans.free')}
        </p>
        {pro ? (
          <>
            <p className="text-fg-muted mt-2">
              {t('plans.onPro')}{' '}
              {pro.currentPeriodEnd &&
                t(pro.cancelAtPeriodEnd ? 'plans.endsOn' : 'plans.renewsOn', {
                  date: dateFormat.format(new Date(pro.currentPeriodEnd)),
                })}
            </p>
            {pro.provider === 'stripe' && canBuy && (
              <form action={openBillingPortal} className="mt-4">
                <button type="submit" className={buttonClass.secondary}>
                  {t('plans.manage')}
                </button>
              </form>
            )}
            {(pro.provider === 'app_store' || pro.provider === 'play_store') && (
              <p className="text-fg-muted mt-2 text-sm">
                {t('plans.manageInStore', { store: storeName[pro.provider] })}
              </p>
            )}
          </>
        ) : (
          <p className="text-fg-muted mt-2">
            {t('plans.freeSummary', { count: FREE_QUESTIONS_PER_COUNTRY })}
          </p>
        )}
        {summary.passes.length > 0 && (
          <ul className="mt-4 space-y-1">
            {summary.passes.map((code) => (
              <li key={code} className="font-medium">
                {t('plans.passFor', { country: nameOf(code) })}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!canBuy && (summary.canBuyPro || summary.passCountries.length > 0) && (
        <div className="mt-6">
          <Notice tone="neutral">{t('plans.unavailable')}</Notice>
        </div>
      )}

      {summary.canBuyPro && (
        <section aria-labelledby="pro" className={`${card} mt-6`}>
          <h2 id="pro" className="font-display text-2xl font-semibold">
            {t('plans.pro')}
          </h2>
          <ul className="mt-3 list-disc space-y-1 ps-5">
            <li>{t('plans.proSummary')}</li>
            <li>{ai('pro')}</li>
          </ul>
          <form action={startCheckout} className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              name="plan"
              value="pro_yearly"
              disabled={!canBuy}
              className={buttonClass.primary}
            >
              {t('plans.getYearly')}
              {price(t, prices, 'pro_yearly', 'plans.perYear') &&
                `: ${price(t, prices, 'pro_yearly', 'plans.perYear')}`}
            </button>
            <button
              type="submit"
              name="plan"
              value="pro_monthly"
              disabled={!canBuy}
              className={buttonClass.secondary}
            >
              {t('plans.getMonthly')}
              {price(t, prices, 'pro_monthly', 'plans.perMonth') &&
                `: ${price(t, prices, 'pro_monthly', 'plans.perMonth')}`}
            </button>
          </form>
          <p className="text-fg-muted mt-4 text-sm">{t('plans.terms')}</p>
        </section>
      )}

      {summary.passCountries.length > 0 && (
        <section aria-labelledby="pass" className={`${card} mt-6`}>
          <h2 id="pass" className="font-display text-2xl font-semibold">
            {t('plans.countryPass')}
          </h2>
          <p className="mt-3">{t('plans.passSummary')}</p>
          <p className="text-fg-muted mt-1 text-sm">
            {price(t, prices, 'country_pass', 'plans.once') ?? t('plans.passNote')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {summary.passCountries.map((code) => (
              // One form per country: the country travels with the button pressed.
              <form key={code} action={startCheckout}>
                <input type="hidden" name="plan" value="country_pass" />
                <input type="hidden" name="countryCode" value={code} />
                <button type="submit" disabled={!canBuy} className={buttonClass.secondary}>
                  {t('plans.getPass', { country: nameOf(code) })}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}

      <p className="text-fg-muted mt-10 text-sm">{t('common.notAffiliated')}</p>
    </main>
  );
}
