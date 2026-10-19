import { MINIMUM_AGE, mustAcceptTerms, TERMS_VERSION, type ExamOutcome } from '@oathly/core';
import type pg from 'pg';

import type { ExamCountry, Me } from '../me';
import { onboardingSchema, type OnboardingInput } from '../onboarding';
import { listEntitlements } from './billing';
import { countryCompleteness } from './countries';
import { listMemberships } from './org';

// Server-side reads and writes for the signed-in learner. These run on the
// owner connection, so every query is scoped to `userId` explicitly; callers
// must pass an id that came from a verified session or token.

type Db = Pick<pg.Pool, 'query'>;

export class OnboardingError extends Error {
  override readonly name = 'OnboardingError';
}

/**
 * Makes sure a signed-in user has a profile. True when this call created it:
 * the moment an account begins.
 */
export async function ensureProfile(
  db: Db,
  userId: string,
  displayName: string | null,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `insert into public.profiles (id, display_name) values ($1, $2)
     on conflict (id) do nothing`,
    [userId, displayName?.trim().slice(0, 60) || null],
  );
  return rowCount === 1;
}

/**
 * Records how a learner's real exam went, as they report it. False when they
 * are not studying that country. Reporting again replaces what was said: a
 * mis-tap, or a retake.
 */
export async function reportExamResult(
  db: Db,
  userId: string,
  countryCode: string,
  result: ExamOutcome,
  now: Date = new Date(),
): Promise<boolean> {
  const { rowCount } = await db.query(
    `update public.user_countries
     set exam_result = $3, exam_result_at = $4
     where user_id = $1 and country_code = $2`,
    [userId, countryCode.toUpperCase(), result, now],
  );
  return rowCount === 1;
}

export async function getMe(db: Db, userId: string): Promise<Me | null> {
  const profile = await db.query<{ id: string; display_name: string | null }>(
    'select id, display_name from public.profiles where id = $1',
    [userId],
  );
  const row = profile.rows[0];
  if (!row) return null;

  const [settings, countries, progress] = await Promise.all([
    db.query<{
      daily_goal_minutes: number;
      onboarded_at: Date | null;
      terms_accepted_at: Date | null;
      analytics_opt_out: boolean;
    }>(
      `select daily_goal_minutes, onboarded_at, terms_accepted_at, analytics_opt_out
       from public.user_settings where user_id = $1`,
      [userId],
    ),
    db.query<{
      country_code: string;
      name: string;
      exam_date: string | null;
      study_locale: string | null;
      is_primary: boolean;
    }>(
      `select uc.country_code, c.name, to_char(uc.exam_date, 'YYYY-MM-DD') as exam_date,
              uc.study_locale, uc.is_primary
       from public.user_countries uc
       join public.countries c on c.iso_code = uc.country_code
       where uc.user_id = $1
       order by uc.is_primary desc, uc.created_at`,
      [userId],
    ),
    db.query<{ attempts: string; answered: string; correct: string }>(
      `select (select count(*) from public.attempts where user_id = $1) as attempts,
              count(*) as answered,
              count(*) filter (where correct) as correct
       from public.answer_events where user_id = $1`,
      [userId],
    ),
  ]);

  const codes = countries.rows.map((country) => country.country_code);
  const completeness = codes.length > 0 ? await countryCompleteness(db, codes) : new Map();
  const settingsRow = settings.rows[0];
  const progressRow = progress.rows[0]!;
  return {
    profile: { id: row.id, displayName: row.display_name },
    settings: settingsRow
      ? {
          dailyGoalMinutes: settingsRow.daily_goal_minutes,
          onboardedAt: settingsRow.onboarded_at?.toISOString() ?? null,
          termsAcceptedAt: settingsRow.terms_accepted_at?.toISOString() ?? null,
          analyticsOptOut: settingsRow.analytics_opt_out,
        }
      : null,
    studyCountries: countries.rows.map((country) => ({
      countryCode: country.country_code,
      countryName: country.name,
      examDate: country.exam_date,
      studyLocale: country.study_locale,
      isPrimary: country.is_primary,
      complete: completeness.get(country.country_code) ?? false,
    })),
    progress: {
      attempts: Number(progressRow.attempts),
      questionsAnswered: Number(progressRow.answered),
      correctAnswers: Number(progressRow.correct),
    },
    entitlements: await listEntitlements(db, userId),
    organizations: await listMemberships(db, userId),
  };
}

/** Countries a learner can choose: the ones with a citizenship exam. */
export async function listExamCountries(db: Db): Promise<ExamCountry[]> {
  const { rows } = await db.query<{ iso_code: string; name: string; exam_languages: string[] }>(
    'select iso_code, name, exam_languages from public.countries where has_exam order by name',
  );
  return rows.map((row) => ({
    isoCode: row.iso_code,
    name: row.name,
    examLanguages: row.exam_languages,
  }));
}

/**
 * Saves an onboarding answer: adds (or updates) a country the learner studies
 * and their daily goal. Run again with another country to study several.
 */
export async function saveOnboarding(
  pool: pg.Pool,
  userId: string,
  input: OnboardingInput,
): Promise<void> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    throw new OnboardingError(parsed.error.issues.map((issue) => issue.message).join(' '));
  }
  const answer = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('begin');
    const country = await client.query(
      'select 1 from public.countries where iso_code = $1 and has_exam',
      [answer.countryCode],
    );
    if (!country.rowCount) throw new OnboardingError('Swornly does not cover that country yet.');

    // Nobody starts studying without confirming their age and accepting the
    // terms. Asked once: after that it is on record, with the version agreed to.
    const accepted = await client.query<{ terms_accepted_at: Date | null }>(
      'select terms_accepted_at from public.user_settings where user_id = $1',
      [userId],
    );
    const accepting = mustAcceptTerms(accepted.rows[0]?.terms_accepted_at);
    if (accepting && answer.acceptedTerms !== true) {
      throw new OnboardingError(
        `Confirm that you are ${MINIMUM_AGE} or older and that you accept the terms and the privacy policy.`,
      );
    }

    await client.query(
      `insert into public.user_settings
         (user_id, daily_goal_minutes, onboarded_at, terms_accepted_at, terms_version)
       values ($1, $2, now(), $3, $4)
       on conflict (user_id) do update
         set daily_goal_minutes = excluded.daily_goal_minutes,
             onboarded_at = coalesce(public.user_settings.onboarded_at, excluded.onboarded_at),
             terms_accepted_at =
               coalesce(public.user_settings.terms_accepted_at, excluded.terms_accepted_at),
             terms_version = coalesce(public.user_settings.terms_version, excluded.terms_version)`,
      [
        userId,
        answer.dailyGoalMinutes,
        accepting ? new Date() : null,
        accepting ? TERMS_VERSION : null,
      ],
    );

    const existing = await client.query<{ has_primary: boolean }>(
      'select bool_or(is_primary) as has_primary from public.user_countries where user_id = $1',
      [userId],
    );
    const makePrimary = answer.makePrimary || !existing.rows[0]?.has_primary;
    if (makePrimary) {
      await client.query(
        'update public.user_countries set is_primary = false where user_id = $1 and is_primary',
        [userId],
      );
    }
    await client.query(
      `insert into public.user_countries (user_id, country_code, exam_date, study_locale, is_primary)
       values ($1, $2, $3, $4, $5)
       on conflict (user_id, country_code) do update
         set exam_date = excluded.exam_date,
             study_locale = excluded.study_locale,
             is_primary = public.user_countries.is_primary or excluded.is_primary`,
      [userId, answer.countryCode, answer.examDate, answer.studyLocale, makePrimary],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

/** Stops studying a country. If it was the primary one, the oldest remaining one takes over. */
export async function removeStudyCountry(
  pool: pg.Pool,
  userId: string,
  countryCode: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      'delete from public.user_countries where user_id = $1 and country_code = $2',
      [userId, countryCode],
    );
    await client.query(
      `update public.user_countries set is_primary = true
       where user_id = $1
         and not exists (select 1 from public.user_countries where user_id = $1 and is_primary)
         and country_code = (select country_code from public.user_countries
                             where user_id = $1 order by created_at limit 1)`,
      [userId],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
