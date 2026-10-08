import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { I18nProvider } from '@/lib/i18n';
import { startMonitoring, withMonitoring } from '@/lib/monitoring';
import { DataProviders } from '@/lib/query';
import { SessionProvider } from '@/lib/session';

// Before anything renders, so a failure on the first screen is reported too.
startMonitoring();

function RootLayout() {
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

export default withMonitoring(RootLayout);

const styles = StyleSheet.create({ fill: { flex: 1 } });
