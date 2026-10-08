import { rateDecision, rateWindowStart, type RateDecision, type RateLimitRule } from '@oathly/core';
import type pg from 'pg';

type Db = Pick<pg.Pool, 'query'>;

/**
 * Counts one call against a limit and says whether it is allowed. The count
 * is kept in Postgres, so it holds across server instances; one statement, so
 * two calls arriving together are both counted.
 *
 * `key` names the caller and what they are doing (see rateLimitKey). Never
 * put a raw network address or an email address in it: hash them first.
 */
export async function takeRateLimit(
  db: Db,
  key: string,
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<RateDecision> {
  const { rows } = await db.query<{ count: number }>(
    `insert into public.rate_limits (key, window_start) values ($1, $2)
     on conflict (key, window_start) do update set count = public.rate_limits.count + 1
     returning count`,
    [key, rateWindowStart(rule, now)],
  );
  return rateDecision(rule, rows[0]!.count, now);
}

/** Deletes counters whose windows ended more than a day ago. Returns how many. */
export async function pruneRateLimits(db: Db, now: Date = new Date()): Promise<number> {
  const { rowCount } = await db.query('delete from public.rate_limits where window_start < $1', [
    new Date(now.getTime() - 24 * 60 * 60 * 1000),
  ]);
  return rowCount ?? 0;
}
