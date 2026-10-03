import { describe, expect, it } from 'vitest';

import { endonym, isStudyLocale, languageName, studyLocales, textDirection } from './index';

describe('study locales', () => {
  it('are unique and recognised', () => {
    expect(new Set(studyLocales).size).toBe(studyLocales.length);
    expect(isStudyLocale('bn')).toBe(true);
    expect(isStudyLocale('xx')).toBe(false);
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
