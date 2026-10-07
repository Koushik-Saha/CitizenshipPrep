import { aiAllowance, checkQuota, type AiFeature, type Quota } from '@oathly/core';
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
