import {
  createTranslator,
  defaultLocale,
  isUiLocale,
  matchUiLocale,
  textDirection,
  type Translator,
  type UiLocale,
} from '@oathly/i18n';
import { catalogs } from '@oathly/i18n/messages';
import { getLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { kv } from './storage';

// The app's language: the phone's, unless the learner has picked another in
// their profile. The same message files as the web app (packages/i18n).
//
// Changing language takes effect at once. Right-to-left languages are laid
// out with the `direction` style on the root view rather than
// I18nManager.forceRTL, which would need the app to restart.

const STORAGE_KEY = 'oathly.app-locale';

/** The first of the phone's preferred languages that Oathly has. */
function deviceLocale(): UiLocale {
  for (const locale of getLocales()) {
    const match = matchUiLocale(locale.languageTag);
    if (match) return match;
  }
  return defaultLocale;
}

interface I18n {
  locale: UiLocale;
  direction: 'ltr' | 'rtl';
  t: Translator;
  setLocale: (locale: UiLocale) => void;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(deviceLocale);

  // A language chosen on an earlier launch.
  useEffect(() => {
    let cancelled = false;
    void kv.get(STORAGE_KEY).then((saved) => {
      if (!cancelled && saved && isUiLocale(saved)) setLocaleState(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<I18n>(
    () => ({
      locale,
      direction: textDirection(locale),
      t: createTranslator(locale, catalogs[locale]),
      setLocale: (next) => {
        setLocaleState(next);
        void kv.set(STORAGE_KEY, next);
      },
    }),
    [locale],
  );

  return (
    <I18nContext value={value}>
      <View style={[styles.fill, { direction: value.direction }]}>{children}</View>
    </I18nContext>
  );
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n needs an I18nProvider above it.');
  return value;
}

/** The message lookup for the app's language. */
export function useT(): Translator {
  return useI18n().t;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
