import { describe, expect, it, vi } from 'vitest';

import { describeNotify, notifyContentChanged } from './notify';

const env = { SITE_URL: 'https://oathly.example/', REVALIDATE_SECRET: 's'.repeat(40) };

describe('notifyContentChanged', () => {
  it('skips when the site or secret is not configured', async () => {
    const result = await notifyContentChanged({ env: { SITE_URL: 'https://x.example' } });
    expect(result.outcome).toBe('skipped');
    expect(describeNotify(result)).toMatch(/within the hour/);
  });

  it('posts to the webhook with the secret and the country', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ revalidated: ['/', '/countries', '/countries/us'] }),
    );
    const result = await notifyContentChanged({ env, countryCode: 'US', fetch });
    expect(fetch).toHaveBeenCalledWith(
      'https://oathly.example/api/revalidate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: `Bearer ${env.REVALIDATE_SECRET}` }),
        body: '{"country":"US"}',
      }),
    );
    expect(describeNotify(result)).toBe('Public pages refreshed: /, /countries, /countries/us.');
  });

  it('refreshes everything when no country is given, and copes with an empty answer', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({}));
    const result = await notifyContentChanged({ env, fetch });
    expect(fetch.mock.calls[0]![1]).toMatchObject({ body: '{}' });
    expect(result).toEqual({ outcome: 'sent', paths: [] });
  });

  it('reports a refused or unreachable webhook without throwing', async () => {
    const refused = await notifyContentChanged({
      env,
      fetch: async () => new Response('no', { status: 401 }),
    });
    expect(describeNotify(refused)).toMatch(/HTTP 401/);
    const down = await notifyContentChanged({
      env,
      fetch: async () => {
        throw new Error('connect ECONNREFUSED');
      },
    });
    expect(describeNotify(down)).toMatch(/ECONNREFUSED/);
    const odd = await notifyContentChanged({
      env,
      fetch: async () => {
        throw 'boom';
      },
    });
    expect(odd).toEqual({ outcome: 'failed', reason: 'boom' });
  });
});
