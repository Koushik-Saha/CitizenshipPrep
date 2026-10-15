import { TERMS_VERSION } from '@oathly/core';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { nextStep } from '../me';
import {
  ensureProfile,
  getMe,
  listExamCountries,
  OnboardingError,
  removeStudyCountry,
  saveOnboarding,
} from './me';

// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;
const USER = 'test-learner-api';
const OTHER = 'test-other-api';

describe.skipIf(!url)('learner data against the database', () => {
  let pool: pg.Pool;

  const cleanUp = () =>
    pool.query('delete from public.profiles where id = any($1)', [[USER, OTHER]]);

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await cleanUp();
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('creates a profile once, on first sign-in', async () => {
    expect(await getMe(pool, USER)).toBeNull();
    await ensureProfile(pool, USER, 'Ana');
    await ensureProfile(pool, USER, 'Someone else');
    const me = await getMe(pool, USER);
    expect(me?.profile).toEqual({ id: USER, displayName: 'Ana' });
    expect(nextStep(me!)).toBe('onboarding');
  });

  it('lists only countries that have an exam', async () => {
    const countries = await listExamCountries(pool);
    expect(countries.map((country) => country.isoCode)).toEqual(
      expect.arrayContaining(['US', 'DE']),
    );
  });

  it('does not let anyone start without confirming their age and accepting the terms', async () => {
    const answers = {
      countryCode: 'US',
      examDate: '2027-03-15',
      studyLocale: 'es',
      dailyGoalMinutes: 20,
    };
    await expect(saveOnboarding(pool, USER, answers)).rejects.toThrow(
      'Confirm that you are 16 or older',
    );
    await expect(saveOnboarding(pool, USER, { ...answers, acceptedTerms: false })).rejects.toThrow(
      OnboardingError,
    );
    // Nothing was saved: they are not studying anything, and nothing is on record.
    const me = (await getMe(pool, USER))!;
    expect(me.studyCountries).toEqual([]);
    expect(me.settings?.termsAcceptedAt ?? null).toBeNull();
  });

  it('saves the onboarding answers and moves the learner on to study', async () => {
    await saveOnboarding(pool, USER, {
      countryCode: 'US',
      examDate: '2027-03-15',
      studyLocale: 'es',
      dailyGoalMinutes: 20,
      acceptedTerms: true,
    });
    // What they accepted, and when, is on record.
    const accepted = await pool.query<{ terms_version: string; recent: boolean }>(
      `select terms_version, terms_accepted_at > now() - interval '1 minute' as recent
       from public.user_settings where user_id = $1`,
      [USER],
    );
    expect(accepted.rows[0]).toEqual({ terms_version: TERMS_VERSION, recent: true });
    const me = (await getMe(pool, USER))!;
    expect(me.settings?.termsAcceptedAt).toEqual(expect.any(String));
    expect(me.settings?.dailyGoalMinutes).toBe(20);
    expect(me.studyCountries).toEqual([
      {
        countryCode: 'US',
        countryName: 'United States',
        examDate: '2027-03-15',
        studyLocale: 'es',
        isPrimary: true,
        // The test database's handful of questions is not a whole country: Beta.
        complete: false,
      },
    ]);
    expect(nextStep(me)).toBe('study');
  });

  it('lets the learner study a second country without losing the first', async () => {
    const first = (await getMe(pool, USER))!.settings!.onboardedAt;
    await saveOnboarding(pool, USER, {
      countryCode: 'DE',
      examDate: null,
      studyLocale: 'en',
      dailyGoalMinutes: 30,
      makePrimary: false,
    });
    const me = (await getMe(pool, USER))!;
    expect(me.studyCountries.map((country) => [country.countryCode, country.isPrimary])).toEqual([
      ['US', true],
      ['DE', false],
    ]);
    // The goal changed; when they first set up, and when they accepted the terms, did not.
    expect(me.settings).toEqual({
      dailyGoalMinutes: 30,
      onboardedAt: first,
      termsAcceptedAt: expect.any(String),
      analyticsOptOut: false,
    });
  });

  it('switches the primary country when asked', async () => {
    await saveOnboarding(pool, USER, {
      countryCode: 'DE',
      examDate: null,
      studyLocale: 'en',
      dailyGoalMinutes: 30,
    });
    const me = (await getMe(pool, USER))!;
    expect(
      me.studyCountries
        .filter((country) => country.isPrimary)
        .map((country) => country.countryCode),
    ).toEqual(['DE']);
  });

  it('hands the primary role on when the primary country is removed', async () => {
    await removeStudyCountry(pool, USER, 'DE');
    const me = (await getMe(pool, USER))!;
    expect(me.studyCountries.map((country) => [country.countryCode, country.isPrimary])).toEqual([
      ['US', true],
    ]);
  });

  it('asks for the terms once: adding a country later needs no second confirmation', async () => {
    const before = await pool.query<{ terms_accepted_at: Date }>(
      'select terms_accepted_at from public.user_settings where user_id = $1',
      [USER],
    );
    // No acceptedTerms here, as when a learner saves the form again or adds an exam.
    await saveOnboarding(pool, USER, {
      countryCode: 'US',
      examDate: '2027-03-15',
      studyLocale: 'es',
      dailyGoalMinutes: 20,
      makePrimary: false,
    });
    const after = await pool.query<{ terms_accepted_at: Date; terms_version: string }>(
      'select terms_accepted_at, terms_version from public.user_settings where user_id = $1',
      [USER],
    );
    // The first record stands: it is not rewritten by a later save.
    expect(after.rows[0]!.terms_accepted_at).toEqual(before.rows[0]!.terms_accepted_at);
    expect(after.rows[0]!.terms_version).toBe(TERMS_VERSION);
  });

  it('refuses invalid answers and countries without an exam', async () => {
    await expect(
      saveOnboarding(pool, USER, {
        countryCode: 'US',
        examDate: null,
        studyLocale: 'xx',
        dailyGoalMinutes: 20,
      }),
    ).rejects.toThrow(OnboardingError);
    await pool.query(
      `insert into public.countries (iso_code, name, has_exam) values ('ZV', 'No-exam land', false)
       on conflict do nothing`,
    );
    await expect(
      saveOnboarding(pool, USER, {
        countryCode: 'ZV',
        examDate: null,
        studyLocale: 'en',
        dailyGoalMinutes: 20,
      }),
    ).rejects.toThrow('Oathly does not cover that country yet.');
    await pool.query(`delete from public.countries where iso_code = 'ZV'`);
  });

  it('keeps each learner’s data separate', async () => {
    await ensureProfile(pool, OTHER, null);
    const other = (await getMe(pool, OTHER))!;
    expect(other.studyCountries).toEqual([]);
    expect(other.settings).toBeNull();
  });
});
