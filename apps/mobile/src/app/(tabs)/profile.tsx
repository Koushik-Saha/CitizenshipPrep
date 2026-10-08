import { daysUntilExam } from '@oathly/api';
import { planSummary } from '@oathly/api/billing';
import { countryName, endonym, languageName, uiLocales, type Translator } from '@oathly/i18n';
import { Redirect, router } from 'expo-router';
import { Text, View } from 'react-native';

import { OfflineBanner } from '@/components/offline-banner';
import {
  Body,
  Button,
  Card,
  Choice,
  Heading,
  LinkButton,
  LoadingScreen,
  Screen,
  useTheme,
} from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { removePack, sync, useOffline } from '@/lib/offline';
import { useSession } from '@/lib/session';

function examDate(days: number | null, t: Translator): string {
  if (days === null) return t('exam.countdownNone');
  if (days < 0) return t('exam.countdownPassed');
  if (days === 0) return t('exam.countdownToday');
  return t('exam.countdownDays', { count: days });
}

export default function Profile() {
  const theme = useTheme();
  const { t, locale, setLocale } = useI18n();
  const session = useSession();
  const offline = useOffline();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  // Opened directly (a deep link) before the session is known: wait, do not bounce.
  if (session.status === 'loading') return <LoadingScreen label={t('common.loading')} />;
  if (session.status !== 'signed-in') return <Redirect href="/" />;
  const { me } = session;
  const accuracy = me.progress.questionsAnswered
    ? `${Math.round((me.progress.correctAnswers / me.progress.questionsAnswered) * 100)}%`
    : '–';
  const packs = Object.values(offline.packs);
  const plan = planSummary(
    me,
    me.studyCountries.map((country) => country.countryCode),
  );

  return (
    <Screen>
      <OfflineBanner />
      <Heading>{me.profile.displayName ?? t('profile.title')}</Heading>

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>{t('profile.progress')}</Heading>
        <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
          {[
            [t('profile.sessions'), String(me.progress.attempts)],
            [t('profile.answered'), String(me.progress.questionsAnswered)],
            [t('profile.correct'), accuracy],
          ].map(([label, value]) => (
            <View
              key={label}
              accessible
              accessibilityLabel={`${label}: ${value}`}
              style={{
                flex: 1,
                padding: theme.spacing[4],
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.surface,
              }}
            >
              <Text style={[theme.text.sm, { color: theme.colors.fgMuted }]}>{label}</Text>
              <Text style={[theme.text['3xl'], { color: theme.colors.fg, fontWeight: '600' }]}>
                {value}
              </Text>
            </View>
          ))}
        </View>
        <Body muted size="sm">
          {t('profile.dailyGoal', { count: me.settings?.dailyGoalMinutes ?? 15 })}
        </Body>
      </View>

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>{t('profile.yourExams')}</Heading>
        {me.studyCountries.map((country) => (
          <Card key={country.countryCode}>
            <Text style={[theme.text.xl, { color: theme.colors.fg, fontWeight: '600' }]}>
              {countryName(country.countryCode, locale, country.countryName)}
            </Text>
            <Body muted>{examDate(daysUntilExam(country), t)}</Body>
            {country.studyLocale && (
              <Body muted>
                {t('profile.studyingIn', { language: languageName(country.studyLocale, locale) })}
              </Body>
            )}
            {country.isPrimary && me.studyCountries.length > 1 && (
              <Body muted>{t('dashboard.opensFirst')}</Body>
            )}
          </Card>
        ))}
        <Button
          label={t('dashboard.addExam')}
          variant="secondary"
          onPress={() => router.push('/onboarding')}
        />
      </View>

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>{t('plans.yourPlan')}</Heading>
        <Card>
          <View testID="profile-plan">
            <Body>{plan.pro ? t('plans.pro') : t('plans.free')}</Body>
          </View>
          {plan.passes.map((code) => (
            <Body key={code} muted>
              {t('plans.passFor', { country: countryName(code, locale, code) })}
            </Body>
          ))}
          <LinkButton
            label={t('plans.seePlans')}
            onPress={() => router.push('/plans')}
            testID="open-plans"
          />
        </Card>
      </View>

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>{t('profile.appLanguage')}</Heading>
        <Body muted size="sm">
          {t('profile.appLanguageHint')}
        </Body>
        {/* Takes effect at once: nothing restarts, and nothing in progress is lost. */}
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}
        >
          {uiLocales.map((option) => (
            <Choice
              key={option}
              label={endonym(option)}
              selected={option === locale}
              onPress={() => setLocale(option)}
              testID={`language-${option}`}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>{t('profile.offline')}</Heading>
        {packs.length === 0 ? (
          <Body muted>{t('profile.noPacks')}</Body>
        ) : (
          packs.map((pack) => (
            <Card key={pack.countryCode}>
              <Body>
                {t('profile.packLine', {
                  country: countryName(pack.countryCode, locale, pack.countryName),
                  count: pack.questions,
                  date: dateFormat.format(new Date(pack.generatedAt)),
                })}
              </Body>
              <LinkButton
                label={t('profile.removePack')}
                tone="danger"
                onPress={() => void removePack(pack.countryCode)}
              />
            </Card>
          ))
        )}
        <Body muted size="sm">
          {offline.waiting === 0
            ? t('profile.allSaved')
            : t('profile.waiting', { count: offline.waiting })}
          {offline.syncProblem && offline.waiting > 0
            ? ` ${t('profile.lastTry', { problem: offline.syncProblem })}`
            : ''}
        </Body>
        {offline.waiting > 0 && (
          <Button
            label={t('profile.sendNow')}
            variant="secondary"
            busy={offline.syncing}
            disabled={!offline.online}
            onPress={() => void sync()}
          />
        )}
      </View>

      <Button
        label={t('common.signOut')}
        variant="secondary"
        onPress={() => void session.signOut().then(() => router.replace('/'))}
        testID="sign-out"
      />
      <LinkButton
        label={t('profile.deleteTitle')}
        onPress={() => router.push('/delete-account')}
        testID="open-delete-account"
      />
      <Body muted size="sm">
        {t('common.notAffiliated')}
      </Body>
    </Screen>
  );
}
