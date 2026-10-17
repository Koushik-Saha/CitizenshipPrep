import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { auditQuestions } from './audit';
import { ensureReviewer } from './review';

// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;
// A code no real country uses, and unlike the other test files' codes.
const COUNTRY = 'ZF';
const REVIEWER = { id: 'test:audit-reviewer', displayName: 'Audit Reviewer' };

const FOUR = JSON.stringify([
  { key: 'a', text: '1066' },
  { key: 'b', text: '1215' },
  { key: 'c', text: '1688' },
  { key: 'd', text: '1832' },
]);

describe.skipIf(!url)('auditing the question bank', () => {
  let pool: pg.Pool;
  const ids: Record<string, string> = {};

  const cleanUp = async () => {
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
    await pool.query('delete from public.profiles where id = $1', [REVIEWER.id]);
  };

  /** Adds a question with an approved English wording, and any further wordings. */
  async function add(
    name: string,
    options: {
      status?: string;
      english: string;
      more?: { locale: string; options: string; status: string }[];
    },
  ) {
    const status = options.status ?? 'published';
    const published = status === 'published';
    const topic = await pool.query<{ id: string }>(
      'select id from public.topics where country_code = $1',
      [COUNTRY],
    );
    const { rows } = await pool.query<{ id: string }>(
      `insert into public.questions
         (country_code, topic_id, difficulty, type, correct_answer, source_url, status,
          verified_by, last_verified_at)
       values ($1, $2, 1, 'multiple_choice', '{"keys": ["b"]}', 'https://example.org/guide',
               $3, $4, $5)
       returning id`,
      [
        COUNTRY,
        topic.rows[0]!.id,
        status,
        published ? REVIEWER.id : null,
        published ? new Date() : null,
      ],
    );
    ids[name] = rows[0]!.id;
    await pool.query(
      `insert into public.question_translations
         (question_id, locale, text, options, explanation, status, reviewed_by, reviewed_at)
       values ($1, 'en', $2, $3, 'It was sealed in 1215. It limited the king.', 'approved', $4, now())`,
      [rows[0]!.id, `When was the charter sealed (${name})?`, options.english, REVIEWER.id],
    );
    for (const more of options.more ?? []) {
      await pool.query(
        `insert into public.question_translations
           (question_id, locale, text, options, explanation, status, translated_from,
            reviewed_by, reviewed_at)
         values ($1, $2, 'Pregunta', $3, 'Se selló en 1215. Limitó al rey.', $4, 'en',
                 $5, $6)`,
        [
          rows[0]!.id,
          more.locale,
          more.options,
          more.status,
          more.status === 'approved' ? REVIEWER.id : null,
          more.status === 'approved' ? new Date() : null,
        ],
      );
    }
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
    await ensureReviewer(pool, REVIEWER, 'reviewer');
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam, exam_languages)
       values ($1, 'Auditland', true, '{en}')`,
      [COUNTRY],
    );
    await pool.query(
      `insert into public.topics (country_code, slug, name) values ($1, 'history', 'History')`,
      [COUNTRY],
    );
    await add('sound', { english: FOUR });
    await add('lonely', { english: JSON.stringify([{ key: 'b', text: '1215' }]) });
    // A broken translation learners can see, and one still in draft that they cannot.
    await add('translated', {
      english: FOUR,
      more: [
        { locale: 'es', options: JSON.stringify([{ key: 'b', text: '1215' }]), status: 'approved' },
        { locale: 'fr', options: '[]', status: 'draft' },
      ],
    });
    // Not shown to learners, so not audited unless asked for.
    await add('drafted', { status: 'draft', english: '[]' });
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('flags only the published questions with faults, in the language they are in', async () => {
    const audit = await auditQuestions(pool, { countryCode: COUNTRY });
    expect(audit.checked).toEqual({ [COUNTRY]: 3 });
    expect(audit.flagged.map((question) => question.id).sort()).toEqual(
      [ids.lonely, ids.translated].sort(),
    );

    const lonely = audit.flagged.find((question) => question.id === ids.lonely)!;
    expect(lonely).toMatchObject({
      countryCode: COUNTRY,
      text: 'When was the charter sealed (lonely)?',
    });
    expect(lonely.problems).toEqual([
      { code: 'option-count', locale: 'en', detail: '1 option(s); a multiple_choice has 4.' },
    ]);

    const translated = audit.flagged.find((question) => question.id === ids.translated)!;
    expect(translated.text).toBe('When was the charter sealed (translated)?');
    expect(translated.problems.map((problem) => [problem.code, problem.locale])).toEqual([
      ['option-count', 'es'],
      ['keys-differ', 'es'],
    ]);
  });

  it('audits other statuses when asked', async () => {
    const audit = await auditQuestions(pool, { countryCode: COUNTRY, statuses: ['draft'] });
    expect(audit.checked).toEqual({ [COUNTRY]: 1 });
    expect(audit.flagged[0]).toMatchObject({ id: ids.drafted, status: 'draft' });
  });
});
