'use client';

import { createOathlyApi } from '@oathly/api/client';
import { OathlyApiProvider } from '@oathly/api/hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// The data cache for the signed-in part of the app. It lives in the /study
// layout, so it survives moving between the dashboard, sessions and the
// tutor: coming back to the dashboard shows the cached numbers at once and
// refreshes them in the background.

// In the browser the session cookie identifies the learner, so no token.
const api = createOathlyApi({
  baseUrl: typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
});

export function StudyProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <OathlyApiProvider api={api}>{children}</OathlyApiProvider>
    </QueryClientProvider>
  );
}
