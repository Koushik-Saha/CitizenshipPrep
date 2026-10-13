import { describe, expect, it } from 'vitest';

import {
  endonym,
  isOfferedStudyLocale,
  isStudyLocale,
  languageName,
  offeredStudyLocales,
  studyLocaleChoices,
  studyLocales,
  textDirection,
  uiLocales,
} from './index';

describe('study locales', () => {
  it('are unique and recognised', () => {
    expect(new Set(studyLocales).size).toBe(studyLocales.length);
    expect(isStudyLocale('bn')).toBe(true);
    expect(isStudyLocale('xx')).toBe(false);
  });

  it('offers the ones the apps are written in, and no others', () => {
    expect([...offeredStudyLocales].sort()).toEqual([...uiLocales].sort());
    expect(isOfferedStudyLocale('es')).toBe(true);
    // A study language, but the apps are not in German yet.
    expect(isStudyLocale('de')).toBe(true);
    expect(isOfferedStudyLocale('de')).toBe(false);
  });

  it('lists the languages on offer, keeping the one a learner already uses', () => {
    expect(studyLocaleChoices()).toBe(offeredStudyLocales);
    expect(studyLocaleChoices(null)).toBe(offeredStudyLocales);
    expect(studyLocaleChoices('es')).toBe(offeredStudyLocales);
    expect(studyLocaleChoices('xx')).toBe(offeredStudyLocales);
    expect(studyLocaleChoices('de')).toEqual([...offeredStudyLocales, 'de']);
  });

  it('every one has a readable name in English and in itself', () => {
    for (const locale of studyLocales) {
      expect(languageName(locale, 'en')).not.toBe(locale);
      expect(endonym(locale).length).toBeGreaterThan(1);
    }
  });

  it('names languages the way their speakers do', () => {
    expect(endonym('de')).toBe('Deutsch');
    expect(endonym('es')).toBe('Español');
    expect(languageName('de', 'en')).toBe('German');
  });

  it('knows which scripts run right to left', () => {
    expect(textDirection('ar')).toBe('rtl');
    expect(textDirection('ur')).toBe('rtl');
    expect(textDirection('zh-Hans')).toBe('ltr');
  });
});
