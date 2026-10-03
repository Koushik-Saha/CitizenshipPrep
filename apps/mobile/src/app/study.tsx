import { daysUntilExam } from '@oathly/api';
import { endonym } from '@oathly/i18n';
import { Redirect, router } from 'expo-router';
import { Text, View } from 'react-native';

import { Body, Button, Heading, Screen, useTheme } from '@/components/ui';
import { useSession } from '@/lib/session';

function countdown(days: number | null): string {
  if (days === null) return 'No exam date set';
  if (days < 0) return 'Exam date has passed';
  if (days === 0) return 'Exam today';
  return days === 1 ? 'Exam tomorrow' : `Exam in ${days} days`;
}

export default function Study() {
  const theme = useTheme();
  const session = useSession();
  if (session.status !== 'signed-in') return <Redirect href="/" />;
  const { me } = session;
  const accuracy = me.progress.questionsAnswered
    ? `${Math.round((me.progress.correctAnswers / me.progress.questionsAnswered) * 100)}%`
    : '–';

  return (
    <Screen>
      <Heading>
        {me.profile.displayName ? `Hi, ${me.profile.displayName}` : 'Your study plan'}
      </Heading>
      <Body muted>{me.settings?.dailyGoalMinutes} minutes a day</Body>

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>Your exams</Heading>
        {me.studyCountries.map((country) => (
          <View
            key={country.countryCode}
            style={{
              padding: theme.spacing[5],
              gap: theme.spacing[1],
              borderRadius: theme.radii.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Text style={[theme.text.xl, { color: theme.colors.fg, fontWeight: '600' }]}>
              {country.countryName}
              {country.isPrimary ? ' · opens first' : ''}
            </Text>
            <Body muted>
              {countdown(daysUntilExam(country))}
              {country.studyLocale ? `. Studying in ${endonym(country.studyLocale)}.` : '.'}
            </Body>
          </View>
        ))}
        <Button
          label="Add another exam"
          variant="secondary"
          onPress={() => router.push('/onboarding')}
        />
      </View>

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
      </View>

      <Button
        label="Sign out"
        variant="secondary"
        onPress={() => void session.signOut().then(() => router.replace('/sign-in'))}
      />
    </Screen>
  );
}
