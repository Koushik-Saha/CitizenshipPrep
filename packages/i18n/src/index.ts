// Locales and translation helpers for native-language study.

import { uiLocales } from './locales';

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

/**
 * The study languages on offer now: the ones the apps' own text also comes
 * in. This is the number the site may claim. The rest of `studyLocales` stay
 * valid for anyone already studying in one, and join the offer when the apps
 * speak them.
 */
export const offeredStudyLocales: readonly StudyLocale[] = studyLocales.filter((locale) =>
  (uiLocales as readonly string[]).includes(locale),
);

export function isOfferedStudyLocale(value: string): value is StudyLocale {
  return (offeredStudyLocales as readonly string[]).includes(value);
}

/**
 * The languages to list when someone picks one to study in: those on offer,
 * and the one they already use if it is not among them, so saving the form
 * again never changes their language behind their back.
 */
export function studyLocaleChoices(current?: string | null): readonly StudyLocale[] {
  if (!current || !isStudyLocale(current) || isOfferedStudyLocale(current)) {
    return offeredStudyLocales;
  }
  return [...offeredStudyLocales, current];
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

/**
 * A country's name in a language, from the browser's own data, so adding a
 * country needs no translation work. Falls back to the stored name for codes
 * the platform does not know.
 */
export function countryName(isoCode: string, inLocale: string, fallback: string): string {
  try {
    const name = new Intl.DisplayNames([inLocale], { type: 'region', fallback: 'none' }).of(
      isoCode.toUpperCase(),
    );
    // "ZZ" is the standard's code for an unknown region.
    return name && isoCode.toUpperCase() !== 'ZZ' ? name : fallback;
  } catch {
    return fallback;
  }
}

/** "A, B, or C", with the reader's language's own commas and "or". */
export function orList(items: readonly string[], inLocale: string): string {
  return new Intl.ListFormat(inLocale, { type: 'disjunction' }).format(items);
}

/** "English or French", in the reader's language. */
export function languageList(languages: readonly string[], inLocale: string): string {
  return orList(
    languages.map((language) => languageName(language, inLocale)),
    inLocale,
  );
}

// Speech engines (a browser's or a phone's voices and recognisers) want a
// language with a region. Most study languages have no region of their own,
// so each gets its most widely supported one.
const speechRegions: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  pl: 'pl-PL',
  ro: 'ro-RO',
  uk: 'uk-UA',
  ru: 'ru-RU',
  tr: 'tr-TR',
  ar: 'ar-SA',
  fa: 'fa-IR',
  ur: 'ur-PK',
  hi: 'hi-IN',
  bn: 'bn-IN',
  pa: 'pa-IN',
  gu: 'gu-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  ne: 'ne-NP',
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  vi: 'vi-VN',
  tl: 'fil-PH',
  am: 'am-ET',
  so: 'so-SO',
  sw: 'sw-KE',
};

/** The tag to give a device's speech engine for one of the app's languages. */
export function speechLocale(locale: string): string {
  return speechRegions[locale] ?? locale;
}

export * from './format';
export * from './locales';
export * from './negotiate';
export * from './translate';
