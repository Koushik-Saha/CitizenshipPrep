import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  exportAccountData,
  exportedTables,
  hasOptedOutOfAnalytics,
  setAnalyticsOptOut,
  updateDisplayName,
} from './account-data';
import { getMe } from './me';

// Runs against the local database (`pnpm db:start`); skipped without one.
const url = process.env.TEST_DATABASE_URL;
// A code no real country uses, and unlike the other test files' codes.
const COUNTRY = 'ZE';
const MINE = 'test:data-mine';
const THEIRS = 'test:data-theirs';
const REVIEWER = 'test:data-reviewer';

describe.skipIf(!url)('a learner’s own data, against the database', () => {
  let pool: pg.Pool;

  const cleanUp = async () => {
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.profiles where id = any($1)', [[MINE, THEIRS, REVIEWER]]);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    await pool.query(
      `insert into public.profiles (id, display_name) values ($1, 'Mine'), ($2, 'Theirs'), ($3, 'Rev')`,
      [MINE, THEIRS, REVIEWER],
    );
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages)
       values ($1, 'Dataland', true, '{en}')`,
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
    for (const user of [MINE, THEIRS]) {
      await pool.query(
        `insert into public.user_countries (user_id, country_code, exam_date)
         values ($1, $2, '2027-02-01')`,
        [user, COUNTRY],
      );
      await pool.query(
        `insert into public.attempts (user_id, country_code, mode, question_count, correct_count)
         values ($1, $2, 'practice', 10, 7)`,
        [user, COUNTRY],
      );
      await pool.query(
        `insert into public.ai_usage (user_id, feature, model, input_tokens, output_tokens)
         values ($1, 'tutor', 'fake-model', 10, 5)`,
        [user],
      );
      await pool.query(
        `insert into public.content_flags
           (question_id, user_id, reason, details, status, resolved_by, resolved_at)
         values ($1, $2, 'typo', $3, 'resolved', $4, now())`,
        [question.rows[0]!.id, user, `A note from ${user}`, REVIEWER],
      );
      await pool.query(
        `insert into public.subscriptions (user_id, plan, status, provider, provider_subscription_id)
         values ($1, 'pro_monthly', 'active', 'manual', $2)`,
        [user, `data-test-${user}`],
      );
    }
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('changes the name a learner goes by, or takes it away', async () => {
    await updateDisplayName(pool, MINE, 'Maria');
    expect((await getMe(pool, MINE))!.profile.displayName).toBe('Maria');
    await updateDisplayName(pool, MINE, null);
    expect((await getMe(pool, MINE))!.profile.displayName).toBeNull();
    // Nobody else's changed.
    expect((await getMe(pool, THEIRS))!.profile.displayName).toBe('Theirs');
    await updateDisplayName(pool, MINE, 'Mine');
  });

  it('records whether a learner wants their use counted', async () => {
    // Nothing said yet, and no settings at all: counted.
    expect(await hasOptedOutOfAnalytics(pool, MINE)).toBe(false);
    await setAnalyticsOptOut(pool, MINE, true);
    expect(await hasOptedOutOfAnalytics(pool, MINE)).toBe(true);
    expect((await getMe(pool, MINE))!.settings?.analyticsOptOut).toBe(true);
    expect(await hasOptedOutOfAnalytics(pool, THEIRS)).toBe(false);
    await setAnalyticsOptOut(pool, MINE, false);
    expect(await hasOptedOutOfAnalytics(pool, MINE)).toBe(false);
    expect(await hasOptedOutOfAnalytics(pool, 'test:data-nobody')).toBe(false);
  });

  it('copies everything held about a learner, and nothing about anyone else', async () => {
    const now = new Date('2026-10-13T12:00:00Z');
    const copy = (await exportAccountData(pool, MINE, now))!;
    expect(copy.exportedAt).toBe('2026-10-13T12:00:00.000Z');
    expect(copy.account).toMatchObject({ id: MINE, displayName: 'Mine' });
    // Every table in the list exists in this database with the columns expected of it:
    // none is skipped, so none is silently missing from a copy.
    expect(Object.keys(copy.data).sort()).toEqual([...exportedTables].sort());
    expect(copy.truncated).toEqual([]);

    expect(copy.data.user_countries).toMatchObject([
      { country_code: COUNTRY, exam_date: '2027-02-01' },
    ]);
    expect(copy.data.attempts).toMatchObject([{ mode: 'practice', correct_count: 7 }]);
    expect(copy.data.ai_usage).toMatchObject([{ feature: 'tutor', input_tokens: 10 }]);
    expect(copy.data.subscriptions).toMatchObject([{ plan: 'pro_monthly', provider: 'manual' }]);
    expect(copy.data.content_flags).toMatchObject([
      { reason: 'typo', details: `A note from ${MINE}`, status: 'resolved' },
    ]);
    // The column that only repeats their id is left out; so is who on the staff dealt with it.
    expect(copy.data.attempts![0]).not.toHaveProperty('user_id');
    expect(copy.data.content_flags![0]).not.toHaveProperty('resolved_by');

    const everything = JSON.stringify(copy);
    expect(everything).not.toContain(THEIRS);
    expect(everything).not.toContain(REVIEWER);
    expect(await exportAccountData(pool, 'test:data-nobody')).toBeNull();
  });
});
