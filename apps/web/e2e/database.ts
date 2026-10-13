import { createPool } from '@oathly/content/db';

/**
 * The scratch database the browser tests run against: the one the development
 * server they start is pointed at. Never a real one.
 */
export const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ??
  'postgres://postgres:postgres@127.0.0.1:54329/oathly_e2e?sslmode=disable';

/** What marks the questions these tests put in the review queue, so each run can clear the last. */
const MARK = 'e2e review queue';

/**
 * Puts Testland questions in the review queue, one per number, for the tests
 * of the reviewers' pages. They are worded like the fixture's ("what is N
 * plus N?"), because once approved a learner test may be asked them; `tag`,
 * when given, is added to each so a test can find its own.
 */
export async function addQuestionsToReview(
  numbers: readonly number[],
  tag = '',
  options: {
    /** "none": the question says nothing of where its answer is in the source. */
    source?: 'located' | 'none';
    /** The words of the guide the answer rests on, when a test needs real ones. */
    quote?: string;
  } = {},
): Promise<void> {
  const pool = createPool(e2eDatabaseUrl);
  try {
    for (const n of numbers) {
      const { rows } = await pool.query<{ id: string }>(
        `insert into public.questions
           (country_code, topic_id, difficulty, type, correct_answer, source_url, status,
            source_quote, source_locator, drafted_by_model)
         select 'ZZ', t.id, 1, 'multiple_choice', '{"keys": ["a"]}',
                'https://example.test/testland/guide', 'in_review', $1, $2, $3
         from public.topics t where t.country_code = 'ZZ' and t.slug = 'government'
         returning id`,
        [
          options.quote ?? MARK,
          options.source === 'none' ? null : 'Testland guide, the chapter on government',
          MARK,
        ],
      );
      await pool.query(
        `insert into public.question_translations (question_id, locale, text, options, explanation, status)
         values ($1, 'en', $2, $3, $4, 'draft')`,
        [
          rows[0]!.id,
          `Testland question ${n}: what is ${n} plus ${n}?${tag ? ` (${tag})` : ''}`,
          JSON.stringify(
            ['a', 'b', 'c', 'd'].map((key, offset) => ({ key, text: String(2 * n + offset) })),
          ),
          `${n} plus ${n} is ${2 * n}.`,
        ],
      );
    }
  } finally {
    await pool.end();
  }
}

/**
 * Starts a run with the same queue every time: whatever earlier runs left
 * (approved, rejected or untouched) is retired, and four questions, 91 to 94,
 * are put in for the tests that only look.
 */
export async function resetReviewQueue(): Promise<void> {
  const pool = createPool(e2eDatabaseUrl);
  try {
    await pool.query(
      `update public.questions set status = 'retired', source_changed_at = null
       where country_code = 'ZZ' and (source_quote = $1 or drafted_by_model = $1)
         and status <> 'retired'`,
      [MARK],
    );
  } finally {
    await pool.end();
  }
  await addQuestionsToReview([91, 92, 93, 94]);
}

/**
 * Forgets the rate limit counters. Limits counted by network address are
 * shared by every test (they all come from this machine), and a scratch
 * database that is used for run after run would otherwise carry one run's
 * count into the next.
 */
export async function resetRateLimits(): Promise<void> {
  const pool = createPool(e2eDatabaseUrl);
  try {
    await pool.query('delete from public.rate_limits');
  } finally {
    await pool.end();
  }
}

/**
 * Gives a test account a staff role, as `pnpm content staff-grant` would. The
 * account then signs in like anyone else and sets up its authenticator.
 */
export async function makeStaff(userId: string, role: 'admin' | 'reviewer'): Promise<void> {
  const pool = createPool(e2eDatabaseUrl);
  try {
    await pool.query('insert into public.profiles (id) values ($1) on conflict (id) do nothing', [
      userId,
    ]);
    await pool.query(
      `insert into public.user_roles (user_id, role) values ($1, $2)
       on conflict (user_id) do update set role = excluded.role`,
      [userId, role],
    );
  } finally {
    await pool.end();
  }
}

/** The record of what staff did, for one account, oldest first: the actions' names. */
export async function auditTrail(userId: string): Promise<string[]> {
  const pool = createPool(e2eDatabaseUrl);
  try {
    const { rows } = await pool.query<{ action: string }>(
      'select action from public.admin_audit_log where actor_id = $1 order by id',
      [userId],
    );
    return rows.map((row) => row.action);
  } finally {
    await pool.end();
  }
}

/** Takes a test account's staff role away, as `pnpm content staff-revoke` would. */
export async function removeStaff(userId: string): Promise<void> {
  const pool = createPool(e2eDatabaseUrl);
  try {
    await pool.query('delete from public.staff_second_factors where user_id = $1', [userId]);
    await pool.query('delete from public.user_roles where user_id = $1', [userId]);
  } finally {
    await pool.end();
  }
}

/** Forgets a test account's authenticator, as `pnpm content staff-reset-2fa` would. */
export async function resetAuthenticator(userId: string): Promise<void> {
  const pool = createPool(e2eDatabaseUrl);
  try {
    await pool.query('delete from public.staff_second_factors where user_id = $1', [userId]);
  } finally {
    await pool.end();
  }
}

/** Runs one statement against the scratch database: for a test to set a scene, or to look. */
export async function sql<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const pool = createPool(e2eDatabaseUrl);
  try {
    return (await pool.query(text, values)).rows as T[];
  } finally {
    await pool.end();
  }
}
