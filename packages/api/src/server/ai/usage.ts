import {
  aiAllowance,
  aiBudgetAlert,
  aiDailyLimit,
  checkQuota,
  withinAiBudget,
  type AiFeature,
  type Quota,
} from '@oathly/core';
import type pg from 'pg';

import { accessUser } from '../billing';
import type { TokenUsage } from './generator';

type Db = Pick<pg.Pool, 'query'>;

/** How much of `feature` the learner has left in the last 24 hours. */
export async function quotaFor(
  db: Db,
  userId: string,
  feature: AiFeature,
  now: Date,
): Promise<Quota> {
  const [user, used] = await Promise.all([
    accessUser(db, userId),
    db.query<{ created_at: Date }>(
      `select created_at from public.ai_usage
       where user_id = $1 and feature = $2 and created_at > $3::timestamptz - interval '24 hours'`,
      [userId, feature, now],
    ),
  ]);
  return checkQuota(
    // The larger allowance is a Pro feature: see hasAccess in packages/core.
    aiAllowance(user, now),
    feature,
    used.rows.map((row) => row.created_at),
    now,
  );
}

export interface UsageOptions {
  /** AI requests the whole service may make in 24 hours. Defaults to AI_DAILY_LIMIT. */
  dailyLimit?: number;
  /** Told when this request is the one that reaches 80% or 100% of the daily limit. */
  onBudgetAlert?: (share: 80 | 100, usedToday: number, limit: number) => void;
}

export type Reservation =
  /** Counted: go ahead. `id` is the usage record to fill in when the reply is done. */
  | { kind: 'reserved'; id: string; quota: Quota }
  /** The learner has used their own allowance. */
  | { kind: 'limited'; quota: Quota }
  /** The service has used its day: nobody on this allowance is answered for now. */
  | { kind: 'paused' };

/**
 * Counts one use of `feature` against the learner and the service, before the
 * model is called. A request is counted when it is made, not when its reply
 * has been read: a client that hangs up early has still been answered, and
 * requests that arrive together cannot all take the last place.
 *
 * The record is written first, then judged by the ones before it, so of
 * several requests at once the earliest wins. One that is refused is removed
 * again and costs the learner nothing.
 */
export async function reserveUsage(
  db: Db,
  entry: {
    userId: string;
    feature: AiFeature;
    countryCode: string | null;
    questionId: string | null;
    model: string;
  },
  now: Date,
  options: UsageOptions = {},
): Promise<Reservation> {
  const [user, inserted] = await Promise.all([
    accessUser(db, entry.userId),
    db.query<{ id: string }>(
      `insert into public.ai_usage
         (user_id, feature, country_code, question_id, model, input_tokens, output_tokens, created_at)
       values ($1, $2, $3, $4, $5, 0, 0, $6)
       returning id`,
      [entry.userId, entry.feature, entry.countryCode, entry.questionId, entry.model, now],
    ),
  ]);
  const id = inserted.rows[0]!.id;
  const [earlier, total] = await Promise.all([
    db.query<{ created_at: Date }>(
      `select created_at from public.ai_usage
       where user_id = $1 and feature = $2 and id < $3
         and created_at > $4::timestamptz - interval '24 hours'`,
      [entry.userId, entry.feature, id, now],
    ),
    db.query<{ used: number }>(
      `select count(*)::int as used from public.ai_usage
       where id <= $1 and created_at > $2::timestamptz - interval '24 hours'`,
      [id, now],
    ),
  ]);
  const allowance = aiAllowance(user, now);
  const quota = checkQuota(
    allowance,
    entry.feature,
    earlier.rows.map((row) => row.created_at),
    now,
  );
  const limit = options.dailyLimit ?? aiDailyLimit(process.env.AI_DAILY_LIMIT);
  const usedToday = total.rows[0]!.used;
  const refusal: Reservation | null = !quota.allowed
    ? { kind: 'limited', quota }
    : withinAiBudget(allowance, usedToday, limit)
      ? null
      : { kind: 'paused' };
  if (refusal) {
    await db.query('delete from public.ai_usage where id = $1', [id]);
    return refusal;
  }
  const alert = aiBudgetAlert(usedToday, limit);
  if (alert) options.onBudgetAlert?.(alert, usedToday, limit);
  return { kind: 'reserved', id, quota: { ...quota, remaining: quota.remaining - 1 } };
}

/** Fills in what a counted request turned out to cost, once its reply is finished. */
export async function completeUsage(
  db: Db,
  id: string,
  result: { model: string; usage: TokenUsage },
): Promise<void> {
  await db.query(
    `update public.ai_usage
     set model = $2, input_tokens = $3, output_tokens = $4,
         cache_read_tokens = $5, cache_write_tokens = $6
     where id = $1`,
    [
      id,
      result.model,
      result.usage.inputTokens,
      result.usage.outputTokens,
      result.usage.cacheReadTokens,
      result.usage.cacheWriteTokens,
    ],
  );
}
