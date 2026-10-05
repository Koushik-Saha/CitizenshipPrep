import { defaultLocale, uiLocales, type UiLocale } from './locales';

// Choosing a UI language from what a browser or phone asks for. Apart from
// ./locales so pages that only build links do not load it.

/**
 * The UI language for a BCP 47 tag, or null if none fits: an exact match,
 * the tag's language ("es-MX" is Spanish), any Chinese as Simplified, and
 * Filipino as Tagalog.
 */
export function matchUiLocale(tag: string): UiLocale | null {
  const exact = uiLocales.find((locale) => locale.toLowerCase() === tag.trim().toLowerCase());
  if (exact) return exact;
  const language = tag.trim().toLowerCase().split('-')[0]!;
  if (language === 'zh') return 'zh-Hans';
  if (language === 'fil') return 'tl';
  return uiLocales.find((locale) => locale === language) ?? null;
}

/** The best UI language for an Accept-Language header, honouring its q-values. */
export function negotiateLocale(acceptLanguage: string | null | undefined): UiLocale {
  const wanted = (acceptLanguage ?? '')
    .split(',')
    .map((entry, index) => {
      const [tag, ...params] = entry.trim().split(';');
      const q = params.map((param) => /^\s*q=([\d.]+)\s*$/.exec(param)?.[1]).find(Boolean);
      const quality = q === undefined ? 1 : Number(q);
      return { tag: tag!, quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((entry) => entry.tag && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const { tag } of wanted) {
    const match = matchUiLocale(tag);
    if (match) return match;
  }
  return defaultLocale;
}
