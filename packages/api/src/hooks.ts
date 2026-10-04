'use client';

// React hooks over the API, for client components on the web and for the
// mobile app. Wrap the tree in <QueryClientProvider> and <OathlyApiProvider>.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, createElement, useContext, type ReactNode } from 'react';

import type { OathlyApi } from './client';
import type { OnboardingInput } from './onboarding';
import { countriesQuery, dashboardQuery, meQuery, queryKeys, sessionQuery } from './queries';
import type { SessionResult, StartSessionRequest } from './study';

const ApiContext = createContext<OathlyApi | null>(null);

export function OathlyApiProvider({ api, children }: { api: OathlyApi; children: ReactNode }) {
  return createElement(ApiContext.Provider, { value: api }, children);
}

export function useOathlyApi(): OathlyApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useOathlyApi needs an <OathlyApiProvider> above it.');
  return api;
}

export const useMe = () => useQuery(meQuery(useOathlyApi()));
export const useDashboard = () => useQuery(dashboardQuery(useOathlyApi()));
export const useExamCountries = () => useQuery(countriesQuery(useOathlyApi()));
export const useStudySession = (attemptId: string) =>
  useQuery(sessionQuery(useOathlyApi(), attemptId));

/** Saves an onboarding answer; the learner and their dashboard update with it. */
export function useSaveOnboarding() {
  const api = useOathlyApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: OnboardingInput) => api.saveOnboarding(input),
    onSuccess: (me) => {
      client.setQueryData(queryKeys.me, me);
      return client.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

/** Starts a session on the server and loads it, ready to run. */
export function useStartSession() {
  const api = useOathlyApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (request: StartSessionRequest) => {
      const { attemptId } = await api.startSession(request);
      return client.fetchQuery(sessionQuery(api, attemptId));
    },
  });
}

/** Records a finished session; the dashboard refreshes behind it. */
export function useCompleteSession() {
  const api = useOathlyApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, result }: { attemptId: string; result: SessionResult }) =>
      api.completeSession(attemptId, result),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.dashboard }),
        client.invalidateQueries({ queryKey: queryKeys.me }),
      ]),
  });
}
