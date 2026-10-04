import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DataProviders } from '@/lib/query';
import { SessionProvider } from '@/lib/session';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.fill}>
      <DataProviders>
        <SessionProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SessionProvider>
      </DataProviders>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
