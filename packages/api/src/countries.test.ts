import { translatorFor } from '@oathly/i18n/messages';
import { describe, expect, it } from 'vitest';

import {
  countryHighlights,
  describeExam,
  localCountryName,
  parseCountryCode,
  searchCountries,
  testPath,
  type CountryFacts,
} from './countries';

const t = translatorFor('en');
const es = translatorFor('es');

const countries = [
  { isoCode: 'AU', name: 'Australia' },
  { isoCode: 'AT', name: 'Austria' },
  { isoCode: 'DE', name: 'Germany' },
  { isoCode: 'CI', name: 'Côte d’Ivoire' },
  { isoCode: 'GB', name: 'United Kingdom' },
  { isoCode: 'US', name: 'United States' },
];

describe('searchCountries', () => {
  it('returns everything for an empty query', () => {
    expect(searchCountries(countries, '  ')).toEqual(countries);
  });

  it('matches names ignoring case and accents, starts first', () => {
    expect(searchCountries(countries, 'aus').map((c) => c.isoCode)).toEqual(['AU', 'AT']);
    expect(searchCountries(countries, 'cote').map((c) => c.isoCode)).toEqual(['CI']);
    expect(searchCountries(countries, 'king').map((c) => c.isoCode)).toEqual(['GB']);
    expect(searchCountries(countries, 'STATES').map((c) => c.isoCode)).toEqual(['US']);
  });

  it('matches an exact ISO code', () => {
    expect(searchCountries(countries, 'de').map((c) => c.isoCode)).toEqual(['DE']);
    expect(searchCountries(countries, 'gb').map((c) => c.isoCode)).toEqual(['GB']);
    expect(searchCountries(countries, 'zz')).toEqual([]);
  });
});

describe('parseCountryCode', () => {
  it('accepts two letters in either case and rejects anything else', () => {
    expect(parseCountryCode('us')).toBe('US');
    expect(parseCountryCode(' DE ')).toBe('DE');
    expect(parseCountryCode('USA')).toBeNull();
    expect(parseCountryCode('1A')).toBeNull();
    expect(parseCountryCode(['US'])).toBeNull();
    expect(parseCountryCode(undefined)).toBeNull();
  });
});

describe('describeExam', () => {
  it('lists what the format fixes, in the reader’s language', () => {
    const exam = { questionCount: 20, passMark: 12, timeLimitMinutes: 45 };
    expect(describeExam(exam, t)).toBe('20 questions, 12 to pass, 45 minutes');
    expect(describeExam(exam, es)).toBe('20 preguntas, 12 para aprobar, 45 minutos');
    expect(describeExam({ questionCount: 1, passMark: null, timeLimitMinutes: null }, t)).toBe(
      '1 question',
    );
    expect(describeExam({ questionCount: null, passMark: null, timeLimitMinutes: null }, t)).toBe(
      '',
    );
  });
});

describe('countryHighlights', () => {
  const canada: CountryFacts = {
    isoCode: 'CA',
    slug: 'canada',
    name: 'Canada',
    examLanguages: ['en', 'fr'],
    latitude: 56.1,
    longitude: -106.3,
    exams: [
      {
        name: 'Citizenship test',
        formatType: 'written',
        questionCount: 20,
        passMark: 15,
        timeLimitMinutes: 45,
        sourceUrl: 'https://example.org',
        lastVerifiedAt: null,
      },
    ],
    publishedQuestions: 0,
  };

  it('describes the main exam, its languages and the question bank', () => {
    expect(countryHighlights(canada, t)).toEqual([
      'Citizenship test: 20 questions, 15 to pass, 45 minutes',
      'Taken in English or French',
      'Practice questions are being checked',
    ]);
    expect(countryHighlights(canada, es)).toEqual([
      'Citizenship test: 20 preguntas, 15 para aprobar, 45 minutos',
      'Se hace en inglés o francés',
      'Las preguntas de práctica están en revisión',
    ]);
    expect(localCountryName({ isoCode: 'CA', name: 'Canada' }, es)).toBe('Canadá');
    expect(localCountryName({ isoCode: 'ZZ', name: 'Testland' }, es)).toBe('Testland');
  });

  it('copes with an exam without fixed numbers, no languages and one question', () => {
    expect(
      countryHighlights(
        {
          ...canada,
          examLanguages: [],
          exams: [
            {
              ...canada.exams[0]!,
              name: 'Interview',
              questionCount: null,
              passMark: null,
              timeLimitMinutes: null,
            },
          ],
          publishedQuestions: 1,
        },
        t,
      ),
    ).toEqual(['Interview', '1 checked practice question']);
    expect(countryHighlights({ ...canada, exams: [], publishedQuestions: 40 }, t)).toEqual([
      'Taken in English or French',
      '40 checked practice questions',
    ]);
  });
});

describe('testPath', () => {
  it('addresses a country’s test page and each topic under it', () => {
    expect(testPath('united-states')).toBe('/united-states/citizenship-test');
    expect(testPath('canada', 'history')).toBe('/canada/citizenship-test/history');
  });
});
