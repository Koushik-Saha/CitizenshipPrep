import { checkQuota, planFrom, type AiFeature, type Plan, type Quota } from '@oathly/core';
import type pg from 'pg';

import type { TokenUsage } from './generator';

type Db = Pick<pg.Pool, 'query'>;

export async function planForUser(db: Db, userId: string, now: Date): Promise<Plan> {
  const { rows } = await db.query<{
    plan: string;
    status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
    current_period_end: Date | null;
  }>(
    `select s.plan, s.status, s.current_period_end
     from public.subscriptions s
     left join public.org_members m on m.organization_id = s.organization_id and m.user_id = $1
     where s.user_id = $1 or m.user_id is not null`,
    [userId],
  );
  return planFrom(
    rows.map((row) => ({
      plan: row.plan,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
    })),
    now,
  );
}

/** How much of `feature` the learner has left in the last 24 hours. */
export async function quotaFor(
  db: Db,
  userId: string,
  feature: AiFeature,
  now: Date,
): Promise<Quota> {
  const [plan, used] = await Promise.all([
    planForUser(db, userId, now),
    db.query<{ created_at: Date }>(
      `select created_at from public.ai_usage
       where user_id = $1 and feature = $2 and created_at > $3::timestamptz - interval '24 hours'`,
      [userId, feature, now],
    ),
  ]);
  return checkQuota(
    plan,
    feature,
    used.rows.map((row) => row.created_at),
    now,
  );
}

export async function logUsage(
  db: Db,
  entry: {
    userId: string;
    feature: AiFeature;
    countryCode: string | null;
    questionId: string | null;
    model: string;
    usage: TokenUsage;
  },
): Promise<void> {
  await db.query(
    `insert into public.ai_usage
       (user_id, feature, country_code, question_id, model, input_tokens, output_tokens,
        cache_read_tokens, cache_write_tokens)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.userId,
      entry.feature,
      entry.countryCode,
      entry.questionId,
      entry.model,
      entry.usage.inputTokens,
      entry.usage.outputTokens,
      entry.usage.cacheReadTokens,
      entry.usage.cacheWriteTokens,
    ],
  );
}
