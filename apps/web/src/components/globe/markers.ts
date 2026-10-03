import { countryHighlights, type CountryFacts } from '@oathly/api/countries';

import type { GlobeMarker } from './scene-store';

/** Globe markers for the countries that have coordinates. */
export function toMarkers(countries: readonly CountryFacts[]): GlobeMarker[] {
  return countries.flatMap((country) =>
    country.latitude === null || country.longitude === null
      ? []
      : [
          {
            code: country.isoCode,
            name: country.name,
            latitude: country.latitude,
            longitude: country.longitude,
            facts: countryHighlights(country),
          },
        ],
  );
}
