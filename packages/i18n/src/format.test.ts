import { describe, expect, it } from 'vitest';

import { formatMessage, isolate, messageShape } from './format';
import { isUiLocale, localizePath, splitLocalePath } from './locales';
import { matchUiLocale, negotiateLocale } from './negotiate';
import { countryName, languageList, speechLocale, studyLocales } from './index';
import { createTranslator, pickMessages } from './translate';
import { en } from './messages/en';

describe('formatMessage', () => {
  it('returns plain text untouched and fills named values', () => {
    expect(formatMessage('Sign in', {}, 'en')).toBe('Sign in');
    expect(formatMessage('Study for {country}', { country: 'Canada' }, 'en')).toBe(
      'Study for Canada',
    );
    // A missing value stays visible rather than vanishing.
    expect(formatMessage('Hi, {name}', {}, 'en')).toBe('Hi, {name}');
  });

  it('picks plural forms by the language’s rules', () => {
    const message = '{count, plural, one {# question} other {# questions}}';
    expect(formatMessage(message, { count: 1 }, 'en')).toBe('1 question');
    expect(formatMessage(message, { count: 0 }, 'en')).toBe('0 questions');
    // French counts zero as singular.
    expect(formatMessage(message, { count: 0 }, 'fr')).toBe('0 question');
    const arabic = '{count, plural, one {a} two {b} few {c} many {d} other {e}}';
    expect([1, 2, 3, 11, 100].map((count) => formatMessage(arabic, { count }, 'ar'))).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('prefers an exact match, and falls back to "other"', () => {
    const message = '{count, plural, =0 {None} one {One} other {Many}}';
    expect(formatMessage(message, { count: 0 }, 'en')).toBe('None');
    expect(formatMessage('{count, plural, other {# 天}}', { count: 1 }, 'en')).toBe('1 天');
  });

  it('handles values inside plural options and text around them', () => {
    const message =
      'Saved: {count, plural, one {{country}: # question} other {{country}: # questions}}, {date}.';
    expect(formatMessage(message, { count: 2, country: 'Chile', date: 'today' }, 'en')).toBe(
      'Saved: Chile: 2 questions, today.',
    );
    // "#" is only special inside a plural.
    expect(formatMessage('Item #{n}', { n: 4 }, 'en')).toBe('Item #4');
  });

  it('rejects malformed messages', () => {
    expect(() => formatMessage('{open', {}, 'en')).toThrow('Unclosed');
    expect(() => formatMessage('{a} close}', { a: 1 }, 'en')).toThrow('Unexpected');
    // Without any placeholder a brace is just text.
    expect(formatMessage('close}', {}, 'en')).toBe('close}');
    expect(() => formatMessage('{n, select, a {x}}', {}, 'en')).toThrow('Only "plural"');
    expect(() => formatMessage('{n, plural}', {}, 'en')).toThrow('Only "plural"');
    expect(() => formatMessage('{n, plural, one {x', { n: 1 }, 'en')).toThrow('Unclosed');
    expect(() => formatMessage('{n, plural, one }', { n: 1 }, 'en')).toThrow('Unclosed');
    expect(() => formatMessage('{n, plural, one {x}}', { n: 5 }, 'en')).toThrow('no "other"');
  });

  it('isolates text of another direction', () => {
    expect(isolate('5 plus 5 is 10.')).toBe('\u20685 plus 5 is 10.\u2069');
  });

  it('describes a message’s placeholders', () => {
    expect(messageShape('{b} and {a, plural, one {# {c}} other {#}}')).toEqual({
      names: ['a', 'b', 'c'],
      plurals: { a: ['one', 'other'] },
    });
  });
});

describe('locales', () => {
  it('matches browser language tags to UI languages', () => {
    expect(matchUiLocale('es-MX')).toBe('es');
    expect(matchUiLocale('zh-CN')).toBe('zh-Hans');
    expect(matchUiLocale('ZH-hans')).toBe('zh-Hans');
    expect(matchUiLocale('fil-PH')).toBe('tl');
    expect(matchUiLocale('de')).toBeNull();
    expect(isUiLocale('ar')).toBe(true);
    expect(isUiLocale('de')).toBe(false);
  });

  it('negotiates from Accept-Language by preference', () => {
    expect(negotiateLocale('de-DE,de;q=0.9,pt-BR;q=0.8,en;q=0.7')).toBe('pt');
    expect(negotiateLocale('en;q=0.5, ar;q=0.9')).toBe('ar');
    expect(negotiateLocale('de, ja')).toBe('en');
    // q=0 means "not this one"; an unreadable q counts as none.
    expect(negotiateLocale('hi;q=0, bn;q=1.2.3, vi')).toBe('vi');
    expect(negotiateLocale(null)).toBe('en');
    expect(negotiateLocale('')).toBe('en');
  });

  it('splits and builds localised paths', () => {
    expect(splitLocalePath('/es/countries/us')).toEqual({ locale: 'es', path: '/countries/us' });
    expect(splitLocalePath('/zh-Hans')).toEqual({ locale: 'zh-Hans', path: '/' });
    expect(splitLocalePath('/countries')).toEqual({ locale: null, path: '/countries' });
    expect(splitLocalePath('/')).toEqual({ locale: null, path: '/' });
    expect(splitLocalePath('')).toEqual({ locale: null, path: '/' });
    expect(localizePath('en', '/study')).toBe('/study');
    expect(localizePath('ar', '/study')).toBe('/ar/study');
    expect(localizePath('ar', '/')).toBe('/ar');
  });
});

describe('names', () => {
  it('names countries in the reader’s language, with a fallback', () => {
    expect(countryName('de', 'es', 'Germany')).toBe('Alemania');
    expect(countryName('US', 'fr', 'United States')).toBe('États-Unis');
    expect(countryName('ZZ', 'es', 'Testland')).toBe('Testland');
    expect(countryName('not a code', 'es', 'Somewhere')).toBe('Somewhere');
  });

  it('lists languages with "or"', () => {
    expect(languageList(['en', 'fr'], 'en')).toBe('English or French');
    expect(languageList(['en', 'fr'], 'es')).toBe('inglés o francés');
  });
});

describe('speechLocale', () => {
  it('gives every study language a region a speech engine understands', () => {
    for (const locale of studyLocales) {
      expect(speechLocale(locale), locale).toMatch(/^[a-z]{2,3}-[A-Z]{2}$/);
    }
    expect(speechLocale('zh-Hans')).toBe('zh-CN');
    expect(speechLocale('tl')).toBe('fil-PH');
    // Already regional, or unknown: left as it is.
    expect(speechLocale('en-GB')).toBe('en-GB');
  });
});

describe('createTranslator', () => {
  it('looks up, formats, and shows the key for what it was not given', () => {
    const t = createTranslator('en', pickMessages(en, ['common', 'exam']));
    expect(t.locale).toBe('en');
    expect(t('common.signIn')).toBe('Sign in');
    expect(t('exam.minutes', { count: 1 })).toBe('1 minute');
    expect(t('landing.heroTitle')).toBe('landing.heroTitle');
  });
});
