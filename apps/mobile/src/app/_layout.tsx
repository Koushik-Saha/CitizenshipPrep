import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { I18nProvider } from '@/lib/i18n';
import { DataProviders } from '@/lib/query';
import { SessionProvider } from '@/lib/session';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.fill}>
      <I18nProvider>
        <DataProviders>
          <SessionProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </SessionProvider>
        </DataProviders>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
