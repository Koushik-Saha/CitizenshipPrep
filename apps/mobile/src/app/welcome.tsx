import { usePublicCountries } from '@oathly/api/hooks';
import { themeFor } from '@oathly/tokens';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WelcomeGlobe } from '@/components/globe/welcome-globe';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';

// The first screen for someone who is not signed in: the globe, with every
// country Oathly covers glowing on it. Always dark, like the web landing hero.
const theme = themeFor('dark');

export default function Welcome() {
  const session = useSession();
  const t = useT();
  const countries = usePublicCountries();
  if (session.status === 'signed-in') return <Redirect href="/" />;

  const markers = (countries.data ?? []).flatMap((country) =>
    country.latitude === null || country.longitude === null
      ? []
      : [{ code: country.isoCode, latitude: country.latitude, longitude: country.longitude }],
  );
  const count = countries.data?.length ?? 0;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing[6], gap: theme.spacing[5] }}>
        <WelcomeGlobe markers={markers} />
        <Text
          accessibilityRole="header"
          style={[theme.text['4xl'], { color: theme.colors.fg, fontWeight: '600' }]}
        >
          {t('landing.heroTitle')}
        </Text>
        <Text style={[theme.text.lg, { color: theme.colors.fgMuted }]}>
          {t('landing.heroBody')}
          {count > 1 ? ` ${t('welcome.countriesSoFar', { count })}` : ''}
        </Text>
        <View style={{ gap: theme.spacing[3] }}>
          <Button
            label={t('welcome.getStarted')}
            variant="accent"
            onPress={() => router.push('/sign-in')}
            testID="get-started"
          />
        </View>
        <Text style={[theme.text.sm, { color: theme.colors.fgSubtle }]}>
          {t('common.notAffiliated')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
