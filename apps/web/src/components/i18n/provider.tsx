'use client';

import { createTranslator, type MessageKey, type Translator } from '@oathly/i18n';
import { useContext, useMemo } from 'react';

import { I18nContext } from './locale';

// Translation for Client Components: looks messages up in what the nearest
// I18nProvider (locale.tsx) was given.

export { I18nProvider, useLocale, useLocalePath } from './locale';

/** The message lookup for the page's language. */
export function useT(): Translator {
  const { locale, messages } = useContext(I18nContext);
  return useMemo(() => createTranslator(locale, messages), [locale, messages]);
}

/**
 * One message, for the few Server Components that are not told the language:
 * loading.tsx files get no params.
 */
export function T({ k }: { k: MessageKey }) {
  return useT()(k);
}
