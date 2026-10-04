// Cache keys and query definitions for TanStack Query, shared by the web and
// mobile apps. No React here: Server Components use the keys to seed the
// cache, and the hooks in ./hooks wrap these for components.

import { queryOptions } from '@tanstack/react-query';

import type { OathlyApi } from './client';

export const queryKeys = {
  me: ['me'] as const,
  countries: ['countries'] as const,
  dashboard: ['dashboard'] as const,
  session: (attemptId: string) => ['session', attemptId] as const,
  pack: (countryCode: string) => ['pack', countryCode] as const,
};

/**
 * Dashboard data is shown from cache at once and refreshed in the background
 * when older than this (stale-while-revalidate). Finishing a session
 * invalidates it, so the numbers never lag a session behind.
 */
export const DASHBOARD_STALE_MS = 30_000;
/** How long unused data stays in memory for an instant return visit. */
export const CACHE_MS = 30 * 60_000;

export const meQuery = (api: OathlyApi) =>
  queryOptions({ queryKey: queryKeys.me, queryFn: () => api.me(), staleTime: DASHBOARD_STALE_MS });

export const dashboardQuery = (api: OathlyApi) =>
  queryOptions({
    queryKey: queryKeys.dashboard,
    queryFn: () => api.dashboard(),
    staleTime: DASHBOARD_STALE_MS,
    gcTime: CACHE_MS,
  });

/** The list of countries changes when content is published, not minute to minute. */
export const countriesQuery = (api: OathlyApi) =>
  queryOptions({
    queryKey: queryKeys.countries,
    queryFn: () => api.countries(),
    staleTime: 10 * 60_000,
  });

/** A session's questions are fixed once it starts. */
export const sessionQuery = (api: OathlyApi, attemptId: string) =>
  queryOptions({
    queryKey: queryKeys.session(attemptId),
    queryFn: () => api.session(attemptId),
    staleTime: Infinity,
  });
