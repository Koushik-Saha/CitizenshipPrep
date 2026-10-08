import {
  deletionBlocker,
  storeSubscriptionsToCancel,
  type DeletionBlocker,
  type DeletionPurchase,
} from '@oathly/core';
import type pg from 'pg';

// Deleting an account, at the learner's own request. Everything a learner
// has made here hangs off their profile and goes with it (the foreign keys
// cascade): answers, sessions, mastery, study plan, settings, purchases,
// memberships. What decides whether they may is in packages/core (account.ts).

type Db = Pick<pg.Pool | pg.PoolClient, 'query'>;

export class AccountError extends Error {
  override readonly name = 'AccountError';
  constructor(readonly blocker: DeletionBlocker) {
    super(`This account cannot be deleted yet: ${blocker}.`);
  }
}

/** What deleting an account would involve, worked out before anything is touched. */
export interface DeletionPlan {
  /** Why it cannot go ahead, or null. */
  blocker: DeletionBlocker | null;
  /** Stripe subscriptions to cancel first: nobody should be charged for a deleted account. */
  stripeSubscriptionIds: string[];
  /** Stores where the learner has to cancel a subscription themselves. */
  storesToCancel: ('app_store' | 'play_store')[];
  /** Organizations that go with the account: owned, empty, and not paid for. */
  organizationsToRemove: string[];
}

const IN_FORCE = `status in ('active', 'trialing', 'past_due')
                  and (current_period_end is null or current_period_end > $2)`;

export async function getDeletionPlan(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<DeletionPlan> {
  const [verified, owned, purchases] = await Promise.all([
    db.query<{ count: string }>(
      `select (select count(*) from public.questions where verified_by = $1)
            + (select count(*) from public.question_translations where reviewed_by = $1) as count`,
      [userId],
    ),
    db.query<{ id: string; other_members: string; has_seats: boolean }>(
      `select m.organization_id as id,
              (select count(*) from public.org_members o
               where o.organization_id = m.organization_id and o.user_id <> $1) as other_members,
              exists (select 1 from public.subscriptions s
                      where s.organization_id = m.organization_id and ${IN_FORCE}) as has_seats
       from public.org_members m
       where m.user_id = $1 and m.role = 'owner'`,
      [userId, now],
    ),
    db.query<{
      provider: DeletionPurchase['provider'];
      plan: string;
      provider_subscription_id: string | null;
      cancel_at_period_end: boolean;
    }>(
      `select provider, plan, provider_subscription_id, cancel_at_period_end
       from public.subscriptions
       where user_id = $1 and ${IN_FORCE}`,
      [userId, now],
    ),
  ]);

  // A Country Pass is bought once; everything else renews until cancelled.
  const renewing = purchases.rows.map((row) => ({
    ...row,
    renews: row.plan !== 'country_pass' && !row.cancel_at_period_end,
  }));
  const organizations = owned.rows.map((row) => ({
    id: row.id,
    otherMembers: Number(row.other_members),
    hasSeats: row.has_seats,
  }));
  return {
    blocker: deletionBlocker({
      verifiedContent: Number(verified.rows[0]!.count),
      ownedOrganizations: organizations,
    }),
    stripeSubscriptionIds: renewing
      .filter((row) => row.provider === 'stripe' && row.renews && row.provider_subscription_id)
      .map((row) => row.provider_subscription_id!),
    storesToCancel: storeSubscriptionsToCancel(renewing),
    organizationsToRemove: organizations
      .filter((organization) => organization.otherMembers === 0 && !organization.hasSeats)
      .map((organization) => organization.id),
  };
}

/**
 * Deletes a learner's account and everything they made here, for good.
 * Throws AccountError when something stands in the way; nothing is deleted
 * then. Cancelling payments is the caller's job, before this (see
 * DeletionPlan): this only removes what is stored.
 *
 * The sign-in account itself is kept by the sign-in service, and is removed
 * there, by the app, once this has succeeded.
 */
export async function deleteAccount(
  pool: pg.Pool,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    // One deletion at a time for an account; a second finds nothing left.
    await client.query('select 1 from public.profiles where id = $1 for update', [userId]);
    const plan = await getDeletionPlan(client, userId, now);
    if (plan.blocker) throw new AccountError(plan.blocker);
    if (plan.organizationsToRemove.length > 0) {
      await client.query('delete from public.organizations where id = any($1)', [
        plan.organizationsToRemove,
      ]);
    }
    // Rate limit counters are kept under the account's id.
    await client.query(
      `delete from public.rate_limits
       where position(':user:' in key) > 0
         and substr(key, position(':user:' in key) + 6) = $1`,
      [userId],
    );
    await client.query('delete from public.profiles where id = $1', [userId]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
