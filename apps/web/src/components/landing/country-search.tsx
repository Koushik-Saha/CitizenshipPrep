'use client';

import { searchCountries } from '@oathly/api/country-search';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { focusRing } from '@/components/focus-ring';

export interface SearchableCountry {
  isoCode: string;
  name: string;
  /** e.g. "Citizenship test: 20 questions, 15 to pass" */
  detail: string;
}

const startHref = (code: string) => `/sign-in?country=${code}`;

/** The hero's country search: type a country, go straight to signing up for its exam. */
export function CountrySearch({ countries }: { countries: SearchableCountry[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputId = useId();
  const statusId = useId();
  const searching = query.trim() !== '';
  const matches = searching ? searchCountries(countries, query).slice(0, 6) : [];

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        if (matches[0]) router.push(startHref(matches[0].isoCode));
      }}
    >
      <label htmlFor={inputId} className="mb-2 block font-medium">
        Which country’s citizenship test are you taking?
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={countries
          .slice(0, 3)
          .map((country) => country.name)
          .join(', ')}
        autoComplete="off"
        aria-describedby={statusId}
        className={`bg-surface border-border-strong text-fg placeholder:text-fg-subtle w-full rounded-md border px-4 py-3 text-lg ${focusRing}`}
      />
      <p id={statusId} className="sr-only" aria-live="polite">
        {searching
          ? matches.length === 0
            ? 'No matching country.'
            : `${matches.length} matching ${matches.length === 1 ? 'country' : 'countries'}. Press Tab to reach them.`
          : ''}
      </p>
      {searching && (
        <ul className="bg-surface-raised border-border absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-md border shadow-xl">
          {matches.map((country) => (
            <li key={country.isoCode}>
              <Link
                href={startHref(country.isoCode)}
                className={`hover:bg-surface-sunken block px-4 py-3 ${focusRing} focus-visible:-outline-offset-2`}
              >
                <span className="font-medium">{country.name}</span>
                {country.detail && (
                  <span className="text-fg-muted block text-sm">{country.detail}</span>
                )}
              </Link>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="text-fg-muted px-4 py-3">
              No match for “{query.trim()}” yet. We add countries once we’ve checked their exam
              against official sources.
            </li>
          )}
        </ul>
      )}
    </form>
  );
}
