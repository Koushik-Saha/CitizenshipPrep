'use client';

import type { PartialMessages } from '@oathly/i18n';
import { localizePath, type UiLocale } from '@oathly/i18n/locales';
import { createContext, useContext, useMemo } from 'react';

// The page's language, for Client Components. The server also hands over the
// message groups a part of the app needs (see clientMessages), so the browser
// never downloads every language or every screen's text. Providers nest: an
// inner one adds its groups to the outer one's.
//
// Kept apart from the message formatter (see provider.tsx), so pages whose
// client code only needs the language, like the landing page, do not load it.

export interface I18n {
  locale: UiLocale;
  messages: PartialMessages;
}

export const I18nContext = createContext<I18n>({ locale: 'en', messages: {} });

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: UiLocale;
  messages: PartialMessages;
  children: React.ReactNode;
}) {
  const outer = useContext(I18nContext);
  const value = useMemo(
    () => ({ locale, messages: { ...outer.messages, ...messages } }),
    [locale, messages, outer.messages],
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useLocale(): UiLocale {
  return useContext(I18nContext).locale;
}

/** Turns an app path into its URL in the page's language: "/study" is "/es/study" in Spanish. */
export function useLocalePath(): (path: string) => string {
  const locale = useLocale();
  return (path) => localizePath(locale, path);
}
