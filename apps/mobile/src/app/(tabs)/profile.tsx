import { daysUntilExam } from '@oathly/api';
import { endonym } from '@oathly/i18n';
import { Redirect, router } from 'expo-router';
import { Text, View } from 'react-native';

import { OfflineBanner } from '@/components/offline-banner';
import {
  Body,
  Button,
  Card,
  Heading,
  LinkButton,
  LoadingScreen,
  Screen,
  useTheme,
} from '@/components/ui';
import { removePack, sync, useOffline } from '@/lib/offline';
import { useSession } from '@/lib/session';

function examDate(days: number | null): string {
  if (days === null) return 'No exam date set';
  if (days < 0) return 'Exam date has passed';
  if (days === 0) return 'Exam today';
  return days === 1 ? 'Exam tomorrow' : `Exam in ${days} days`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export default function Profile() {
  const theme = useTheme();
  const session = useSession();
  const offline = useOffline();
  // Opened directly (a deep link) before the session is known: wait, do not bounce.
  if (session.status === 'loading') return <LoadingScreen label="Loading" />;
  if (session.status !== 'signed-in') return <Redirect href="/" />;
  const { me } = session;
  const accuracy = me.progress.questionsAnswered
    ? `${Math.round((me.progress.correctAnswers / me.progress.questionsAnswered) * 100)}%`
    : '–';
  const packs = Object.values(offline.packs);

  return (
    <Screen>
      <OfflineBanner />
      <Heading>{me.profile.displayName ?? 'Your profile'}</Heading>

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>Progress</Heading>
        <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
          {[
            ['Sessions', String(me.progress.attempts)],
            ['Answered', String(me.progress.questionsAnswered)],
            ['Correct', accuracy],
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
          Daily goal: {me.settings?.dailyGoalMinutes ?? 15} minutes.
        </Body>
      </View>

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>Your exams</Heading>
        {me.studyCountries.map((country) => (
          <Card key={country.countryCode}>
            <Text style={[theme.text.xl, { color: theme.colors.fg, fontWeight: '600' }]}>
              {country.countryName}
            </Text>
            <Body muted>
              {examDate(daysUntilExam(country))}
              {country.studyLocale ? `. Studying in ${endonym(country.studyLocale)}.` : '.'}
              {country.isPrimary && me.studyCountries.length > 1 ? ' Opens first.' : ''}
            </Body>
          </Card>
        ))}
        <Button
          label="Add another exam"
          variant="secondary"
          onPress={() => router.push('/onboarding')}
        />
      </View>

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>Offline</Heading>
        {packs.length === 0 ? (
          <Body muted>
            No countries saved on this phone yet. Save one from the Study tab to practise with no
            connection.
          </Body>
        ) : (
          packs.map((pack) => (
            <Card key={pack.countryCode}>
              <Body>
                {pack.countryName}: {pack.questions} questions, saved{' '}
                {dateFormat.format(new Date(pack.generatedAt))}.
              </Body>
              <LinkButton
                label="Remove from this phone"
                tone="danger"
                onPress={() => void removePack(pack.countryCode)}
              />
            </Card>
          ))
        )}
        <Body muted size="sm">
          {offline.waiting === 0
            ? 'Everything you have answered is saved to your account.'
            : `${offline.waiting} saved ${offline.waiting === 1 ? 'item is' : 'items are'} waiting to be sent.`}
          {offline.syncProblem && offline.waiting > 0 ? ` Last try: ${offline.syncProblem}` : ''}
        </Body>
        {offline.waiting > 0 && (
          <Button
            label="Send now"
            variant="secondary"
            busy={offline.syncing}
            disabled={!offline.online}
            onPress={() => void sync()}
          />
        )}
      </View>

      <Button
        label="Sign out"
        variant="secondary"
        onPress={() => void session.signOut().then(() => router.replace('/'))}
        testID="sign-out"
      />
      <Body muted size="sm">
        Oathly is an independent study app. It is not affiliated with any government.
      </Body>
    </Screen>
  );
}
