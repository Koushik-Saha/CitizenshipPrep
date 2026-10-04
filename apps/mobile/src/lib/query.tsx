import AsyncStorage from '@react-native-async-storage/async-storage';
import { OathlyApiProvider } from '@oathly/api/hooks';
import { queryKeys } from '@oathly/api/queries';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { api } from './auth';
import { onSynced, startOffline } from './offline';

// The app's data cache: the same queries the web app uses (packages/api),
// kept on the phone between launches so the dashboard and any session in
// progress open at once, with or without a connection.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Long enough for what is persisted to be restored and used.
      gcTime: WEEK_MS,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'oathly.query-cache.v1',
  throttleTime: 1_000,
});

export function DataProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void startOffline();
    // React Query refetches stale data when the app comes back to the front.
    const appState = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
    });
    // Answers that just reached the server change the dashboard's numbers.
    const synced = onSynced(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    });
    return () => {
      appState.remove();
      synced();
    };
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: WEEK_MS,
        dehydrateOptions: { shouldDehydrateQuery: (query) => query.state.status === 'success' },
      }}
    >
      <OathlyApiProvider api={api}>{children}</OathlyApiProvider>
    </PersistQueryClientProvider>
  );
}
