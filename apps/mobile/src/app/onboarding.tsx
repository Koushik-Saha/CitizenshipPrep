import { dailyGoalOptions, onboardingSchema, searchCountries } from '@oathly/api';
import { useExamCountries, useSaveOnboarding } from '@oathly/api/hooks';
import { endonym, isStudyLocale, studyLocales } from '@oathly/i18n';
import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Body, Button, Choice, Field, Heading, Message, Screen, useTheme } from '@/components/ui';
import { useSession } from '@/lib/session';

function deviceLocale(): string {
  for (const locale of getLocales()) {
    if (isStudyLocale(locale.languageTag)) return locale.languageTag;
    if (locale.languageCode && isStudyLocale(locale.languageCode)) return locale.languageCode;
  }
  return 'en';
}

export default function Onboarding() {
  const theme = useTheme();
  const session = useSession();
  const me = session.status === 'signed-in' ? session.me : null;

  // The same cached queries and mutations the web app uses (packages/api).
  const countries = useExamCountries();
  const save = useSaveOnboarding();
  const [query, setQuery] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [examDate, setExamDate] = useState('');
  const [studyLocale, setStudyLocale] = useState(deviceLocale);
  const [dailyGoal, setDailyGoal] = useState<number>(me?.settings?.dailyGoalMinutes ?? 15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studying = useMemo(
    () => new Set(me?.studyCountries.map((country) => country.countryCode)),
    [me],
  );
  const choices = (countries.data ?? []).filter((country) => !studying.has(country.isoCode));
  const visible = searchCountries(choices, query);

  async function submit() {
    const answer = {
      countryCode,
      examDate: examDate.trim() || null,
      studyLocale,
      dailyGoalMinutes: dailyGoal,
      makePrimary: (me?.studyCountries.length ?? 0) === 0,
    };
    // The same rules the server applies, checked here first for a quicker answer.
    const checked = onboardingSchema.safeParse(answer);
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? 'Check your answers.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await save.mutateAsync(answer);
      await session.refresh();
      router.replace('/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Heading>{me?.studyCountries.length ? 'Add another exam' : 'Set up your study'}</Heading>
      {error && <Message tone="error">{error}</Message>}

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>Which exam are you preparing for?</Heading>
        <Field label="Search countries" value={query} onChangeText={setQuery} autoCorrect={false} />
        {countries.isError ? (
          <Message tone="error">
            We could not load the list of countries. Check your connection and try again.
          </Message>
        ) : countries.data === undefined ? (
          <ActivityIndicator accessibilityLabel="Loading countries" />
        ) : (
          <View accessibilityRole="radiogroup" style={{ gap: theme.spacing[2] }}>
            {visible.map((country) => {
              const selected = country.isoCode === countryCode;
              return (
                <Pressable
                  key={country.isoCode}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setCountryCode(country.isoCode)}
                  testID={`country-${country.isoCode}`}
                  style={{
                    padding: theme.spacing[4],
                    borderWidth: selected ? 2 : 1,
                    borderRadius: theme.radii.md,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  }}
                >
                  <Text
                    style={[
                      theme.text.lg,
                      { color: theme.colors.fg, fontWeight: selected ? '600' : '400' },
                    ]}
                  >
                    {country.name}
                  </Text>
                </Pressable>
              );
            })}
            {visible.length === 0 && <Body muted>No country matches “{query}”.</Body>}
          </View>
        )}
      </View>

      <Field
        label="Exam date (optional)"
        hint="Year-month-day, for example 2027-03-15. We use it to pace your study plan."
        value={examDate}
        onChangeText={setExamDate}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>Study language</Heading>
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}
        >
          {studyLocales.map((locale) => (
            <Choice
              key={locale}
              label={endonym(locale)}
              selected={locale === studyLocale}
              onPress={() => setStudyLocale(locale)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>Minutes a day</Heading>
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}
        >
          {dailyGoalOptions.map((minutes) => (
            <Choice
              key={minutes}
              label={`${minutes} min`}
              selected={minutes === dailyGoal}
              onPress={() => setDailyGoal(minutes)}
            />
          ))}
        </View>
      </View>

      <Button
        label={me?.studyCountries.length ? 'Add this exam' : 'Start studying'}
        onPress={() => void submit()}
        busy={busy}
        disabled={!countryCode}
        testID="finish-onboarding"
      />
    </Screen>
  );
}
