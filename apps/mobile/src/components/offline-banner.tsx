import { Text, View } from 'react-native';

import { useTheme } from '@/components/ui';
import { useOffline } from '@/lib/offline';

/** Says when the phone is offline, and how much is waiting to be sent. */
export function OfflineBanner() {
  const theme = useTheme();
  const { online, waiting, syncing } = useOffline();
  if (online && waiting === 0) return null;

  // Answers and session results both count: say "saved", not "answers".
  const things = `${waiting} saved ${waiting === 1 ? 'item' : 'items'}`;
  const message = !online
    ? waiting > 0
      ? `You are offline. ${things} will be sent when you are back online.`
      : 'You are offline. Saved countries still work.'
    : syncing
      ? `Sending ${things}…`
      : `${things} waiting to be sent.`;

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
