import { Text, View } from 'react-native';

import { useTheme } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useOffline } from '@/lib/offline';

/** Says when the phone is offline, and how much is waiting to be sent. */
export function OfflineBanner() {
  const theme = useTheme();
  const t = useT();
  const { online, waiting, syncing } = useOffline();
  if (online && waiting === 0) return null;

  // Answers and session results both count: the messages say "saved items".
  const message = !online
    ? waiting > 0
      ? t('offline.bannerOfflineWaiting', { count: waiting })
      : t('offline.bannerOffline')
    : syncing
      ? t('offline.bannerSending', { count: waiting })
      : t('offline.bannerWaiting', { count: waiting });

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      testID="offline-banner"
      style={{
        padding: theme.spacing[3],
        borderRadius: theme.radii.md,
        backgroundColor: online ? theme.colors.primarySoft : theme.colors.accentSoft,
      }}
    >
      <Text
        style={[theme.text.sm, { color: online ? theme.colors.primaryFg : theme.colors.accentFg }]}
      >
        {message}
      </Text>
    </View>
  );
}
