'use client';

import { searchCountries } from '@oathly/api/country-search';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { focusRing } from '@/components/focus-ring';

export interface SearchableCountry {
  isoCode: string;
  name: string;
  /** Where choosing it goes, in the page's language: its trial. */
  href: string;
  /** e.g. "Citizenship test: 20 questions, 15 to pass" */
  detail: string;
}

/** Where the typed text goes in `SearchText.noMatch`. */
export const QUERY_SLOT = '\u0000';
/** The most matches the list shows. */
export const MAX_MATCHES = 6;

/**
 * The search's wording, already in the reader's language: the server fills
 * the messages in, so the landing page does not load the message formatter.
 */
export interface SearchText {
  label: string;
  /** A few of the countries as examples, listed the reader's way ("A, B, or C"). */
  placeholder: string;
  /** With QUERY_SLOT where the typed text goes. */
  noMatch: string;
  statusNone: string;
  /** "3 matching countries…", for 1 match up to MAX_MATCHES. */
  status: string[];
}

/** The hero's country search: type a country, go straight to a round of its test. */
export function CountrySearch({
  countries,
  text,
}: {
  countries: SearchableCountry[];
  text: SearchText;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputId = useId();
  const statusId = useId();
  const searching = query.trim() !== '';
  const matches = searching ? searchCountries(countries, query).slice(0, MAX_MATCHES) : [];

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        if (matches[0]) router.push(matches[0].href);
      }}
    >
      <label htmlFor={inputId} className="mb-2 block font-medium">
        {text.label}
      </label>
      <input
        id={inputId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={text.placeholder}
        autoComplete="off"
        aria-describedby={statusId}
        className={`bg-surface border-border-strong text-fg placeholder:text-fg-subtle w-full rounded-md border px-4 py-3 text-lg ${focusRing}`}
      />
      <p id={statusId} className="sr-only" aria-live="polite">
        {searching
          ? matches.length === 0
            ? text.statusNone
            : text.status[matches.length - 1]
          : ''}
      </p>
      {searching && (
        <ul className="bg-surface-raised border-border absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-md border shadow-xl">
          {matches.map((country) => (
            <li key={country.isoCode}>
              <Link
                href={country.href}
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
              {text.noMatch.replace(QUERY_SLOT, query.trim())}
            </li>
          )}
        </ul>
      )}
    </form>
  );
}
