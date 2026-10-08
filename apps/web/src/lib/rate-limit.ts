import { createHmac } from 'node:crypto';

import { pruneRateLimits, takeRateLimit } from '@oathly/api/server';
import { rateLimitKey, rateLimitRules, type RateLimitName } from '@oathly/core';

import { getDb } from './db';
import { reportError } from './monitoring';

// Rate limiting for route handlers. The rules are in packages/core
// (rate-limit.ts); the counters are in Postgres, so they hold across server
// instances.

/**
 * Network and email addresses are counted under a keyed hash, never as
 * themselves: the counters say how often, not who.
 */
function anonymous(value: string): string {
  const key = process.env.RATE_LIMIT_SECRET || process.env.DATABASE_URL || 'oathly';
  return createHmac('sha256', key).update(value).digest('hex').slice(0, 32);
}

/** The caller's network address, as the host's proxy reports it. */
export function addressOf(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return anonymous(forwarded || request.headers.get('x-real-ip') || 'unknown');
}

export const emailKey = (email: string) => anonymous(email.trim().toLowerCase());

/**
 * Counts this call against a limit. Null when it may go ahead; otherwise the
 * 429 to answer with, which says how long to wait.
 *
 * If the count cannot be kept (the database is unreachable), the call goes
 * ahead and the failure is reported: a limiter that is down must not take
 * sign-in down with it.
 */
export async function rateLimited(
  name: RateLimitName,
  kind: 'user' | 'address' | 'email',
  id: string,
): Promise<Response | null> {
  let decision;
  try {
    decision = await takeRateLimit(getDb(), rateLimitKey(name, kind, id), rateLimitRules[name]);
  } catch (error) {
    reportError(error, { where: 'rate-limit', limit: name });
    return null;
  }
  // Old counters are cleared as new ones are written: now and then, off the
  // request's path, rather than by a job that would need running.
  if (Math.random() < 0.01) void pruneRateLimits(getDb()).catch(() => {});
  if (decision.allowed) return null;
  const message = 'Too many requests. Wait a moment and try again.';
  return Response.json(
    { error: message, message, code: 'RATE_LIMITED' },
    {
      status: 429,
      headers: {
        'retry-after': String(decision.retryAfterSeconds),
        'cache-control': 'no-store',
      },
    },
  );
}
