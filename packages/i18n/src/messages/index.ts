import type { UiLocale } from '../locales';
import { createTranslator, type Translator } from '../translate';

import { ar } from './ar';
import { bn } from './bn';
import { en, type Messages } from './en';
import { es } from './es';
import { fr } from './fr';
import { hi } from './hi';
import { pt } from './pt';
import { tl } from './tl';
import { vi } from './vi';
import { zhHans } from './zh-Hans';

// Every language's messages. Importing this pulls all of them in: fine on a
// server and in the phone app, but browser code should be handed just the
// groups it needs (see pickMessages) instead of importing this file.

export const catalogs: Record<UiLocale, Messages> = {
  en,
  es,
  hi,
  bn,
  ar,
  'zh-Hans': zhHans,
  tl,
  vi,
  pt,
  fr,
};

export type { Messages };

/** A lookup over a language's whole catalog. */
export function translatorFor(locale: UiLocale): Translator {
  return createTranslator(locale, catalogs[locale]);
}
