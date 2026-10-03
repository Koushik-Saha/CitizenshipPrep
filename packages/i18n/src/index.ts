// Locales and translation helpers for native-language study.

/**
 * Languages a learner can choose to study in, as BCP 47 tags. A question is
 * shown in the study language once a reviewed translation exists, and in the
 * exam language until then.
 */
export const studyLocales = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'pl',
  'ro',
  'uk',
  'ru',
  'tr',
  'ar',
  'fa',
  'ur',
  'hi',
  'bn',
  'pa',
  'gu',
  'ta',
  'te',
  'ne',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'vi',
  'tl',
  'am',
  'so',
  'sw',
] as const;

export type StudyLocale = (typeof studyLocales)[number];

export function isStudyLocale(value: string): value is StudyLocale {
  return (studyLocales as readonly string[]).includes(value);
}

/** The language's name in another language, e.g. `languageName('de', 'en')` is "German". */
export function languageName(locale: string, inLocale: string): string {
  try {
    return new Intl.DisplayNames([inLocale], { type: 'language' }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}

/** The language's name in itself, e.g. "Deutsch", which is how people look for their own language. */
export function endonym(locale: string): string {
  const name = languageName(locale, locale);
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

/** Right-to-left scripts among the study languages, for the `dir` attribute. */
export function textDirection(locale: string): 'ltr' | 'rtl' {
  return ['ar', 'fa', 'ur', 'he'].includes(locale.split('-')[0]!) ? 'rtl' : 'ltr';
}
