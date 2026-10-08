import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import type { OathlyApi } from './client';
import {
  countriesQuery,
  dashboardQuery,
  DASHBOARD_STALE_MS,
  meQuery,
  publicCountriesQuery,
  queryKeys,
  sessionQuery,
} from './queries';
import type { Dashboard } from './study';

const dashboard: Dashboard = {
  streakDays: 2,
  minutesToday: 5,
  dailyGoalMinutes: 15,
  countries: [],
};

describe('dashboardQuery', () => {
  it('serves the cache while fresh, and refetches once stale or invalidated', async () => {
    vi.useFakeTimers();
    try {
      const fetchDashboard = vi.fn(async () => dashboard);
      const api = { dashboard: fetchDashboard } as unknown as OathlyApi;
      const client = new QueryClient();

      await expect(client.fetchQuery(dashboardQuery(api))).resolves.toEqual(dashboard);
      await client.fetchQuery(dashboardQuery(api));
      expect(fetchDashboard).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(DASHBOARD_STALE_MS + 1);
      // Stale: still readable from the cache at once...
      expect(client.getQueryData(queryKeys.dashboard)).toEqual(dashboard);
      // ...and the next read goes back to the server.
      await client.fetchQuery(dashboardQuery(api));
      expect(fetchDashboard).toHaveBeenCalledTimes(2);

      await client.invalidateQueries({ queryKey: queryKeys.dashboard });
      await client.fetchQuery(dashboardQuery(api));
      expect(fetchDashboard).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never refetches a session: its questions are fixed', async () => {
    const session = vi.fn(async () => ({ attemptId: 'a' }));
    const api = { session } as unknown as OathlyApi;
    const client = new QueryClient();
    await client.fetchQuery(sessionQuery(api, 'a'));
    await client.fetchQuery(sessionQuery(api, 'a'));
    expect(session).toHaveBeenCalledTimes(1);
    expect(queryKeys.session('a')).toEqual(['session', 'a']);
  });
});

describe('the other queries', () => {
  it('ask the API for what their key names, once while fresh', async () => {
    const api = {
      me: vi.fn(async () => ({ profile: { id: 'u' } })),
      countries: vi.fn(async () => [{ isoCode: 'ZZ' }]),
      publicCountries: vi.fn(async () => [{ isoCode: 'ZZ', slug: 'testland' }]),
    };
    const client = new QueryClient();
    const asApi = api as unknown as OathlyApi;

    await client.fetchQuery(meQuery(asApi));
    await client.fetchQuery(meQuery(asApi));
    expect(api.me).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(queryKeys.me)).toEqual({ profile: { id: 'u' } });

    await client.fetchQuery(countriesQuery(asApi));
    await client.fetchQuery(countriesQuery(asApi));
    expect(api.countries).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(queryKeys.countries)).toEqual([{ isoCode: 'ZZ' }]);

    await client.fetchQuery(publicCountriesQuery(asApi));
    expect(client.getQueryData(queryKeys.publicCountries)).toEqual([
      { isoCode: 'ZZ', slug: 'testland' },
    ]);
  });

  it('keeps each session and each country’s pack under its own key', () => {
    expect(queryKeys.session('a')).not.toEqual(queryKeys.session('b'));
    expect(queryKeys.pack('ZZ')).toEqual(['pack', 'ZZ']);
  });
});
