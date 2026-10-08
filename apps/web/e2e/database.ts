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
export async function addQuestionsToReview(numbers: readonly number[], tag = ''): Promise<void> {
  const pool = createPool(e2eDatabaseUrl);
  try {
    for (const n of numbers) {
      const { rows } = await pool.query<{ id: string }>(
        `insert into public.questions
           (country_code, topic_id, difficulty, type, correct_answer, source_url, status, source_quote)
         select 'ZZ', t.id, 1, 'multiple_choice', '{"keys": ["a"]}',
                'https://example.test/testland/guide', 'in_review', $1
         from public.topics t where t.country_code = 'ZZ' and t.slug = 'government'
         returning id`,
        [MARK],
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
       where country_code = 'ZZ' and source_quote = $1 and status <> 'retired'`,
      [MARK],
    );
  } finally {
    await pool.end();
  }
  await addQuestionsToReview([91, 92, 93, 94]);
}
