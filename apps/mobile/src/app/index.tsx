import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Body, Button, Screen, useTheme } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';

// Sends the learner to the right screen for their session.
export default function Index() {
  const session = useSession();
  const theme = useTheme();
  const t = useT();

  if (session.status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.canvas,
        }}
      >
        <ActivityIndicator accessibilityLabel={t('common.loading')} color={theme.colors.primary} />
      </View>
    );
  }
  if (session.status === 'error') {
    return (
      <Screen>
        <Body>{t('welcome.unreachable')}</Body>
        <Button label={t('common.tryAgain')} onPress={() => void session.refresh()} />
      </Screen>
    );
  }
  if (session.status === 'signed-out') return <Redirect href="/welcome" />;
  return <Redirect href={session.step === 'study' ? '/study' : '/onboarding'} />;
}
