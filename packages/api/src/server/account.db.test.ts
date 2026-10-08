import { rateLimitKey, rateLimitRules } from '@oathly/core';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AccountError, deleteAccount, getDeletionPlan } from './account';
import { ensureProfile, getMe, saveOnboarding } from './me';
import { createOrganization } from './org';
import { takeRateLimit } from './rate-limit';
import { completeAttempt, startPractice } from './study';

// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;
// A code no real country uses, and unlike the other test files' codes.
const COUNTRY = 'ZP';
const LEARNER = 'test:account-learner';
const BYSTANDER = 'test:account-bystander';
const OWNER = 'test:account-owner';
const SOLO = 'test:account-solo';
const REVIEWER = 'test:account-reviewer';
const everyone = [LEARNER, BYSTANDER, OWNER, SOLO];

describe.skipIf(!url)('deleting an account against the database', () => {
  let pool: pg.Pool;
  const now = new Date('2026-10-08T12:00:00Z');
  const count = async (sql: string, params: unknown[]) =>
    Number(
      (await pool.query<{ n: string }>(`select count(*) as n from ${sql}`, params)).rows[0]!.n,
    );

  const cleanUp = async () => {
    await pool.query(`delete from public.organizations where slug like 'account-test-%'`);
    await pool.query('delete from public.profiles where id = any($1)', [everyone]);
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
    await pool.query('delete from public.profiles where id = $1', [REVIEWER]);
    await pool.query(`delete from public.rate_limits where key like '%test:account-%'`);
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    await pool.query(`insert into public.profiles (id, display_name) values ($1, 'Reviewer')`, [
      REVIEWER,
    ]);
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages)
       values ($1, 'Accountland', true, '{en}')`,
      [COUNTRY],
    );
    const topic = await pool.query<{ id: string }>(
      `insert into public.topics (country_code, slug, name) values ($1, 'civics', 'Civics')
       returning id`,
      [COUNTRY],
    );
    const question = await pool.query<{ id: string }>(
      `insert into public.questions
         (country_code, topic_id, difficulty, type, correct_answer, source_url, status,
          verified_by, last_verified_at)
       values ($1, $2, 1, 'multiple_choice', '{"keys": ["a"]}', 'https://example.org/guide',
               'published', $3, now())
       returning id`,
      [COUNTRY, topic.rows[0]!.id, REVIEWER],
    );
    await pool.query(
      `insert into public.question_translations
         (question_id, locale, text, options, status, reviewed_by, reviewed_at)
       values ($1, 'en', 'A question?', '[{"key":"a","text":"A"},{"key":"b","text":"B"}]',
               'approved', $2, now())`,
      [question.rows[0]!.id, REVIEWER],
    );
    for (const user of everyone) {
      await ensureProfile(pool, user, user);
      await saveOnboarding(pool, user, {
        countryCode: COUNTRY,
        examDate: null,
        studyLocale: 'en',
        dailyGoalMinutes: 10,
      });
    }
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('removes everything a learner made, and nothing of anyone else’s', async () => {
    for (const user of [LEARNER, BYSTANDER]) {
      const attempt = await startPractice(
        pool,
        user,
        { countryCode: COUNTRY, mode: 'random', size: 1 },
        'practice',
      );
      await completeAttempt(pool, user, attempt, { correct: 1, total: 1, passed: null });
      await takeRateLimit(pool, rateLimitKey('explain', 'user', user), rateLimitRules.explain, now);
    }
    await pool.query(
      `insert into public.subscriptions (user_id, plan, country_code, status, provider, provider_subscription_id)
       values ($1, 'country_pass', $2, 'active', 'stripe', 'pi_account_test')`,
      [LEARNER, COUNTRY],
    );

    expect(await getDeletionPlan(pool, LEARNER, now)).toEqual({
      blocker: null,
      // A pass was bought once: there is nothing to cancel.
      stripeSubscriptionIds: [],
      storesToCancel: [],
      organizationsToRemove: [],
    });
    await deleteAccount(pool, LEARNER, now);

    expect(await getMe(pool, LEARNER)).toBeNull();
    for (const table of ['attempts', 'user_countries', 'user_settings', 'subscriptions']) {
      expect(await count(`public.${table} where user_id = $1`, [LEARNER]), table).toBe(0);
    }
    expect(await count(`public.rate_limits where key like $1`, [`%${LEARNER}`])).toBe(0);

    // The other learner is untouched, and so is the content both studied.
    expect((await getMe(pool, BYSTANDER))!.progress.attempts).toBe(1);
    expect(await count(`public.rate_limits where key like $1`, [`%${BYSTANDER}`])).toBe(1);
    expect(await count('public.questions where country_code = $1', [COUNTRY])).toBe(1);

    // Deleting again finds nothing, and is not an error.
    await expect(deleteAccount(pool, LEARNER, now)).resolves.toBeUndefined();
  });

  it('says which subscriptions have to be cancelled, and by whom', async () => {
    await pool.query(
      `insert into public.subscriptions
         (user_id, plan, status, provider, provider_subscription_id, cancel_at_period_end,
          current_period_end)
       values ($1, 'pro_monthly', 'active', 'stripe', 'sub_account_test', false, $2),
              ($1, 'pro_yearly', 'active', 'app_store', 'tx_account_test', false, $2),
              ($1, 'pro_monthly', 'active', 'play_store', 'tx_account_cancelled', true, $2),
              ($1, 'pro_monthly', 'expired', 'stripe', 'sub_account_old', false, $3)`,
      [BYSTANDER, new Date('2026-11-08T00:00:00Z'), new Date('2026-01-01T00:00:00Z')],
    );
    const plan = await getDeletionPlan(pool, BYSTANDER, now);
    expect(plan.stripeSubscriptionIds).toEqual(['sub_account_test']);
    // The Play Store one is already set to end; the App Store one will renew.
    expect(plan.storesToCancel).toEqual(['app_store']);
    expect(plan.blocker).toBeNull();
  });

  it('takes an owner’s empty organization with them', async () => {
    const organization = await createOrganization(pool, SOLO, {
      name: 'Account Test Solo',
      kind: 'school',
    });
    await pool.query(`update public.organizations set slug = 'account-test-solo' where id = $1`, [
      organization.id,
    ]);
    expect((await getDeletionPlan(pool, SOLO, now)).organizationsToRemove).toEqual([
      organization.id,
    ]);
    await deleteAccount(pool, SOLO, now);
    expect(await count('public.organizations where id = $1', [organization.id])).toBe(0);
    expect(await getMe(pool, SOLO)).toBeNull();
  });

  it('refuses an owner whose organization has people in it, and deletes nothing', async () => {
    const organization = await createOrganization(pool, OWNER, {
      name: 'Account Test Shared',
      kind: 'school',
    });
    await pool.query(`update public.organizations set slug = 'account-test-shared' where id = $1`, [
      organization.id,
    ]);
    await pool.query(
      `insert into public.org_members (organization_id, user_id, role) values ($1, $2, 'member')`,
      [organization.id, BYSTANDER],
    );
    expect((await getDeletionPlan(pool, OWNER, now)).blocker).toBe('organization');
    const refused = await deleteAccount(pool, OWNER, now).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(AccountError);
    expect((refused as AccountError).blocker).toBe('organization');
    expect(await getMe(pool, OWNER)).not.toBeNull();
    expect(await count('public.organizations where id = $1', [organization.id])).toBe(1);

    // Once the member has gone, so can the owner.
    await pool.query('delete from public.org_members where organization_id = $1 and user_id = $2', [
      organization.id,
      BYSTANDER,
    ]);
    await deleteAccount(pool, OWNER, now);
    expect(await getMe(pool, OWNER)).toBeNull();
  });

  it('refuses a reviewer: what they verified keeps its record', async () => {
    expect((await getDeletionPlan(pool, REVIEWER, now)).blocker).toBe('staff');
    await expect(deleteAccount(pool, REVIEWER, now)).rejects.toMatchObject({ blocker: 'staff' });
    expect(await count('public.profiles where id = $1', [REVIEWER])).toBe(1);
  });
});
