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

  it('saves the onboarding answers and moves the learner on to study', async () => {
    await saveOnboarding(pool, USER, {
      countryCode: 'US',
      examDate: '2027-03-15',
      studyLocale: 'es',
      dailyGoalMinutes: 20,
    });
    const me = (await getMe(pool, USER))!;
    expect(me.settings?.dailyGoalMinutes).toBe(20);
    expect(me.studyCountries).toEqual([
      {
        countryCode: 'US',
        countryName: 'United States',
        examDate: '2027-03-15',
        studyLocale: 'es',
        isPrimary: true,
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
    expect(me.settings).toEqual({ dailyGoalMinutes: 30, onboardedAt: first });
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
      `insert into public.countries (iso_code, name, has_exam) values ('ZW', 'No-exam land', false)
       on conflict do nothing`,
    );
    await expect(
      saveOnboarding(pool, USER, {
        countryCode: 'ZW',
        examDate: null,
        studyLocale: 'en',
        dailyGoalMinutes: 20,
      }),
    ).rejects.toThrow('Oathly does not cover that country yet.');
    await pool.query(`delete from public.countries where iso_code = 'ZW'`);
  });

  it('keeps each learner’s data separate', async () => {
    await ensureProfile(pool, OTHER, null);
    const other = (await getMe(pool, OTHER))!;
    expect(other.studyCountries).toEqual([]);
    expect(other.settings).toBeNull();
  });
});
