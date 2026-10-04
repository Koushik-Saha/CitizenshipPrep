// Tells the web app that public content changed, so its static country and
// topic pages rebuild now rather than within the hour. Calls the publish
// webhook, POST {SITE_URL}/api/revalidate, with REVALIDATE_SECRET.

export type NotifyResult =
  | { outcome: 'sent'; paths: string[] }
  | { outcome: 'skipped'; reason: string }
  | { outcome: 'failed'; reason: string };

interface NotifyOptions {
  /** Refresh one country's pages only; all of them when left out. */
  countryCode?: string;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
}

export async function notifyContentChanged(options: NotifyOptions = {}): Promise<NotifyResult> {
  const env = options.env ?? process.env;
  const site = env.SITE_URL?.replace(/\/+$/, '');
  const secret = env.REVALIDATE_SECRET;
  if (!site || !secret) {
    return {
      outcome: 'skipped',
      reason: 'SITE_URL or REVALIDATE_SECRET is not set; public pages refresh within the hour.',
    };
  }
  try {
    const response = await (options.fetch ?? fetch)(`${site}/api/revalidate`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify(options.countryCode ? { country: options.countryCode } : {}),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { outcome: 'failed', reason: `The site answered HTTP ${response.status}.` };
    }
    const body = (await response.json()) as { revalidated?: string[] };
    return { outcome: 'sent', paths: body.revalidated ?? [] };
  } catch (error) {
    return {
      outcome: 'failed',
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/** One line for the CLI to print. */
export function describeNotify(result: NotifyResult): string {
  switch (result.outcome) {
    case 'sent':
      return `Public pages refreshed: ${result.paths.join(', ')}.`;
    case 'skipped':
      return result.reason;
    case 'failed':
      return `Could not refresh the public pages (${result.reason}); they refresh within the hour.`;
  }
}
