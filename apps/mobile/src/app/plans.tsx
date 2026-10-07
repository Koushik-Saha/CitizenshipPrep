import { planSummary } from '@oathly/api/billing';
import { queryKeys } from '@oathly/api/queries';
import { aiLimits, FREE_QUESTIONS_PER_COUNTRY } from '@oathly/core';
import { countryName } from '@oathly/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import {
  Body,
  Button,
  Card,
  Heading,
  LinkButton,
  LoadingScreen,
  Message,
  Screen,
} from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { backToStudy } from '@/lib/navigation';
import { purchases, type StoreOffer } from '@/lib/purchases';
import { useSession } from '@/lib/session';

/** Where each kind of purchase is managed, by its proper name. */
const storeName = { app_store: 'App Store', play_store: 'Google Play' } as const;

/** How long to keep asking the server for the new plan after a purchase. */
const CHECKS = 10;
const CHECK_EVERY_MS = 2000;

// What the learner holds and what they can buy. The plan shown is the
// server's word, so something bought on the web shows here too, and
// something bought here shows on the web.
export default function Plans() {
  const { t, locale } = useI18n();
  const session = useSession();
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  const userId = session.status === 'signed-in' ? session.me.profile.id : null;
  const offers = useQuery({
    queryKey: ['store-offers', userId],
    queryFn: () => purchases.offers(userId!),
    enabled: userId !== null && purchases.available,
    staleTime: 5 * 60_000,
  });

  // Opening this screen asks the server afresh, so it never shows last week's plan.
  const { refresh } = session;
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (session.status === 'loading') return <LoadingScreen label={t('common.loading')} />;
  if (session.status !== 'signed-in') return <Redirect href="/" />;
  const { me } = session;
  const summary = planSummary(
    me,
    me.studyCountries.map((country) => country.countryCode),
  );
  const { pro } = summary;
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

  /** The store has taken the payment; the server hears a moment later. Wait for it. */
  async function waitForPlan() {
    setThanks(true);
    for (let check = 0; check < CHECKS; check += 1) {
      await session.refresh();
      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
      await new Promise((resolve) => setTimeout(resolve, CHECK_EVERY_MS));
    }
  }

  async function run(key: string, work: () => Promise<boolean>) {
    setBusy(key);
    setProblem(null);
    try {
      if (await work()) await waitForPlan();
    } catch {
      setProblem(t('plans.purchaseFailed'));
    } finally {
      setBusy(null);
    }
  }

  const offer = (plan: StoreOffer['plan'], countryCode: string | null = null) =>
    offers.data?.find(
      (candidate) => candidate.plan === plan && candidate.countryCode === countryCode,
    );
  const monthly = offer('pro_monthly');
  const yearly = offer('pro_yearly');
  const passes = summary.passCountries.flatMap((code) => {
    const found = offer('country_pass', code);
    return found ? [{ code, offer: found }] : [];
  });
  const somethingToBuy = summary.canBuyPro || summary.passCountries.length > 0;

  return (
    <Screen>
      <LinkButton label={t('common.backToStudy')} onPress={backToStudy} testID="plans-back" />
      <Heading>{t('plans.title')}</Heading>
      {thanks && <Message tone="info">{t('plans.thanks')}</Message>}
      {problem && <Message tone="error">{problem}</Message>}

      <Card>
        <Body muted size="sm">
          {t('plans.yourPlan')}
        </Body>
        <View testID="current-plan">
          <Heading level={2}>{pro ? t('plans.pro') : t('plans.free')}</Heading>
        </View>
        {pro ? (
          <>
            <Body muted>
              {pro.plan === 'team' && pro.organizationName
                ? t('org.planFromOrg', { organization: pro.organizationName })
                : t('plans.onPro')}
              {pro.plan !== 'team' && pro.currentPeriodEnd
                ? ` ${t(pro.cancelAtPeriodEnd ? 'plans.endsOn' : 'plans.renewsOn', {
                    date: dateFormat.format(new Date(pro.currentPeriodEnd)),
                  })}`
                : ''}
            </Body>
            {pro.plan !== 'team' && pro.provider === 'stripe' && (
              <Body muted size="sm">
                {t('plans.boughtOnWeb')}
              </Body>
            )}
            {(pro.provider === 'app_store' || pro.provider === 'play_store') &&
              (purchases.available ? (
                <Button
                  label={t('plans.manage')}
                  variant="secondary"
                  onPress={() =>
                    void purchases
                      .manageUrl(me.profile.id)
                      .then((url) => (url ? Linking.openURL(url) : undefined))
                  }
                />
              ) : (
                <Body muted size="sm">
                  {t('plans.manageInStore', { store: storeName[pro.provider] })}
                </Body>
              ))}
          </>
        ) : (
          <Body muted>{t('plans.freeSummary', { count: FREE_QUESTIONS_PER_COUNTRY })}</Body>
        )}
        {summary.passes.map((code) => (
          <Body key={code}>{t('plans.passFor', { country: nameOf(code) })}</Body>
        ))}
      </Card>

      {somethingToBuy && !purchases.available && (
        <Message tone="info">{t('plans.notInThisBuild')}</Message>
      )}

      {summary.canBuyPro && (
        <Card>
          <Heading level={2}>{t('plans.pro')}</Heading>
          <Body>{t('plans.proSummary')}</Body>
          <Body muted size="sm">
            {ai('pro')}
          </Body>
          {yearly && (
            <Button
              label={`${t('plans.getYearly')}: ${t('plans.perYear', { price: yearly.price })}`}
              busy={busy === yearly.productId}
              disabled={busy !== null}
              onPress={() => void run(yearly.productId, yearly.buy)}
              testID="buy-pro-yearly"
            />
          )}
          {monthly && (
            <Button
              label={`${t('plans.getMonthly')}: ${t('plans.perMonth', { price: monthly.price })}`}
              variant="secondary"
              busy={busy === monthly.productId}
              disabled={busy !== null}
              onPress={() => void run(monthly.productId, monthly.buy)}
              testID="buy-pro-monthly"
            />
          )}
          <Body muted size="sm">
            {t('plans.terms')}
          </Body>
        </Card>
      )}

      {summary.passCountries.length > 0 && (
        <Card>
          <Heading level={2}>{t('plans.countryPass')}</Heading>
          <Body>{t('plans.passSummary')}</Body>
          {passes.map(({ code, offer: pass }) => (
            <Button
              key={code}
              label={`${t('plans.getPass', { country: nameOf(code) })}: ${t('plans.once', { price: pass.price })}`}
              variant="secondary"
              busy={busy === pass.productId}
              disabled={busy !== null}
              onPress={() => void run(pass.productId, pass.buy)}
              testID={`buy-pass-${code}`}
            />
          ))}
        </Card>
      )}

      {purchases.available && (
        <LinkButton
          label={t('plans.restore')}
          onPress={() =>
            void run('restore', async () => {
              await purchases.restore(me.profile.id);
              return true;
            })
          }
          testID="restore-purchases"
        />
      )}
      <Body muted size="sm">
        {t('common.notAffiliated')}
      </Body>
    </Screen>
  );
}
