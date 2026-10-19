'use client';

// React hooks over the API, for client components on the web and for the
// mobile app. Wrap the tree in <QueryClientProvider> and <SwornlyApiProvider>.

import type { ExamOutcome } from '@oathly/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, createElement, useContext, type ReactNode } from 'react';

import type { SwornlyApi } from './client';
import type { OnboardingInput } from './onboarding';
import {
  countriesQuery,
  dashboardQuery,
  meQuery,
  publicCountriesQuery,
  queryKeys,
  sessionQuery,
} from './queries';
import type { SessionResult, StartSessionRequest } from './study';

const ApiContext = createContext<SwornlyApi | null>(null);

export function SwornlyApiProvider({ api, children }: { api: SwornlyApi; children: ReactNode }) {
  return createElement(ApiContext.Provider, { value: api }, children);
}

export function useSwornlyApi(): SwornlyApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useSwornlyApi needs an <SwornlyApiProvider> above it.');
  return api;
}

export const useMe = () => useQuery(meQuery(useSwornlyApi()));
export const useDashboard = () => useQuery(dashboardQuery(useSwornlyApi()));
export const useExamCountries = () => useQuery(countriesQuery(useSwornlyApi()));
export const usePublicCountries = () => useQuery(publicCountriesQuery(useSwornlyApi()));
export const useStudySession = (attemptId: string) =>
  useQuery(sessionQuery(useSwornlyApi(), attemptId));

/** Saves an onboarding answer; the learner and their dashboard update with it. */
export function useSaveOnboarding() {
  const api = useSwornlyApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: OnboardingInput) => api.saveOnboarding(input),
    onSuccess: (me) => {
      client.setQueryData(queryKeys.me, me);
      return client.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

/** Reports how the real exam went; the dashboard shows it at once. */
export function useReportExamResult() {
  const api = useSwornlyApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ countryCode, result }: { countryCode: string; result: ExamOutcome }) =>
      api.reportExamResult(countryCode, result),
    onSuccess: (dashboard) => client.setQueryData(queryKeys.dashboard, dashboard),
  });
}

/** Starts a session on the server and loads it, ready to run. */
export function useStartSession() {
  const api = useSwornlyApi();
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
  const api = useSwornlyApi();
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
