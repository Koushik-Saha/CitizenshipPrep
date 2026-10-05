import { countryHighlights, localCountryName, type CountryFacts } from '@oathly/api/countries';
import type { Translator } from '@oathly/i18n';

import type { GlobeMarker } from './scene-store';

/** Globe markers for the countries that have coordinates, described in the reader's language. */
export function toMarkers(countries: readonly CountryFacts[], t: Translator): GlobeMarker[] {
  return countries.flatMap((country) =>
    country.latitude === null || country.longitude === null
      ? []
      : [
          {
            code: country.isoCode,
            name: localCountryName(country, t),
            latitude: country.latitude,
            longitude: country.longitude,
            facts: countryHighlights(country, t),
          },
        ],
  );
}
