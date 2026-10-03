// Country lookup with no dependencies, so client components can use it
// without pulling in the language data.

/** A two-letter ISO code from a query string, or null. */
export function parseCountryCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();

/**
 * Countries matching what someone typed: by name (ignoring accents and case)
 * or by exact ISO code. Names starting with the query come first.
 */
export function searchCountries<T extends { isoCode: string; name: string }>(
  countries: readonly T[],
  query: string,
): T[] {
  const needle = fold(query.trim());
  if (!needle) return [...countries];
  const starts: T[] = [];
  const contains: T[] = [];
  for (const country of countries) {
    const name = fold(country.name);
    if (name.startsWith(needle) || country.isoCode.toLowerCase() === needle) starts.push(country);
    else if (name.includes(needle)) contains.push(country);
  }
  return [...starts, ...contains];
}
