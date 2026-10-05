import { dailyGoalOptions, onboardingSchema, searchCountries } from '@oathly/api';
import { useExamCountries, useSaveOnboarding } from '@oathly/api/hooks';
import { countryName, endonym, isStudyLocale, studyLocales } from '@oathly/i18n';
import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Body, Button, Choice, Field, Heading, Message, Screen, useTheme } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';

/** The language to suggest studying in: the app's, or else the phone's. */
function suggestedLocale(appLocale: string): string {
  if (isStudyLocale(appLocale)) return appLocale;
  for (const locale of getLocales()) {
    if (isStudyLocale(locale.languageTag)) return locale.languageTag;
    if (locale.languageCode && isStudyLocale(locale.languageCode)) return locale.languageCode;
  }
  return 'en';
}

export default function Onboarding() {
  const theme = useTheme();
  const { t, locale: appLocale } = useI18n();
  const session = useSession();
  const me = session.status === 'signed-in' ? session.me : null;

  // The same cached queries and mutations the web app uses (packages/api).
  const countries = useExamCountries();
  const save = useSaveOnboarding();
  const [query, setQuery] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [examDate, setExamDate] = useState('');
  const [studyLocale, setStudyLocale] = useState(() => suggestedLocale(appLocale));
  const [dailyGoal, setDailyGoal] = useState<number>(me?.settings?.dailyGoalMinutes ?? 15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studying = useMemo(
    () => new Set(me?.studyCountries.map((country) => country.countryCode)),
    [me],
  );
  // Listed and searched under the names the reader knows them by.
  const choices = (countries.data ?? [])
    .filter((country) => !studying.has(country.isoCode))
    .map((country) => ({
      ...country,
      name: countryName(country.isoCode, appLocale, country.name),
    }));
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
      setError(checked.error.issues[0]?.message ?? t('onboarding.checkAnswers'));
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
      <Heading>
        {me?.studyCountries.length ? t('onboarding.titleAdd') : t('onboarding.title')}
      </Heading>
      {error && <Message tone="error">{error}</Message>}

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>{t('onboarding.whichExam')}</Heading>
        <Field
          label={t('onboarding.searchCountries')}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {countries.isError ? (
          <Message tone="error">{t('onboarding.countriesFailed')}</Message>
        ) : countries.data === undefined ? (
          <ActivityIndicator accessibilityLabel={t('common.loading')} />
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
            {visible.length === 0 && <Body muted>{t('onboarding.noCountryMatch', { query })}</Body>}
          </View>
        )}
      </View>

      <Field
        label={`${t('onboarding.examDate')} ${t('onboarding.optional')}`}
        hint={t('onboarding.examDateHintMobile')}
        value={examDate}
        onChangeText={setExamDate}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
      />

      <View style={{ gap: theme.spacing[3] }}>
        <Heading level={2}>{t('onboarding.studyLanguage')}</Heading>
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
        <Heading level={2}>{t('onboarding.dailyGoal')}</Heading>
        <View
          accessibilityRole="radiogroup"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}
        >
          {dailyGoalOptions.map((minutes) => (
            <Choice
              key={minutes}
              label={t('onboarding.minutesShort', { count: minutes })}
              selected={minutes === dailyGoal}
              onPress={() => setDailyGoal(minutes)}
            />
          ))}
        </View>
      </View>

      <Button
        label={me?.studyCountries.length ? t('onboarding.add') : t('onboarding.start')}
        onPress={() => void submit()}
        busy={busy}
        disabled={!countryCode}
        testID="finish-onboarding"
      />
    </Screen>
  );
}
