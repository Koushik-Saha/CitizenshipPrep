'use client';

import { dailyGoalOptions, isoDate, type ExamCountry } from '@oathly/api';
import { examLanguageList, searchCountries } from '@oathly/api/countries';
import { endonym, languageName, studyLocales } from '@oathly/i18n';
import { useActionState, useId, useState } from 'react';

import { GlobePoster } from '@/components/globe/globe-poster';
import { GlobeSlot } from '@/components/globe/globe-slot';
import { HERO_VIEW } from '@/components/globe/config';
import type { GlobeMarker } from '@/components/globe/scene-store';
import { buttonClass, fieldClass, focusRing, labelClass, Notice } from '@/components/ui';

import { completeOnboarding, type OnboardingState } from './actions';

interface Props {
  countries: ExamCountry[];
  /** Picked on the landing page before signing in. */
  preselected: string | null;
  /** The countries on the globe beside the list. */
  markers: GlobeMarker[];
  /** Adding a further country rather than onboarding for the first time. */
  adding: boolean;
  defaultLocale: string;
  defaultDailyGoal: number;
}

const initialState: OnboardingState = { error: null };

export function OnboardingForm({
  countries,
  preselected,
  markers,
  adding,
  defaultLocale,
  defaultDailyGoal,
}: Props) {
  const [state, action, pending] = useActionState(completeOnboarding, initialState);
  const [query, setQuery] = useState('');
  const [countryCode, setCountryCode] = useState(
    preselected ?? (countries.length === 1 ? countries[0]!.isoCode : ''),
  );
  const searchId = useId();

  const visible = searchCountries(countries, query);

  return (
    <form action={action} className="space-y-10">
      {state.error && (
        <Notice tone="error" role="alert">
          {state.error}
        </Notice>
      )}

      <fieldset>
        <legend className="font-display text-xl font-medium">
          Which exam are you preparing for?
        </legend>
        <div className="mt-4 grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <div>
            <label htmlFor={searchId} className={`${labelClass} mt-4`}>
              Search countries
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
              className={fieldClass}
            />
            <p className="text-fg-muted mt-2 text-sm" aria-live="polite">
              {visible.length === countries.length
                ? `${countries.length} ${countries.length === 1 ? 'country' : 'countries'}`
                : `${visible.length} of ${countries.length} countries`}
            </p>
            <ul className="border-border bg-surface mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-lg border">
              {visible.map((country) => (
                <li key={country.isoCode}>
                  <label
                    className={`hover:bg-surface-sunken flex cursor-pointer items-center gap-3 px-4 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-focus-ring`}
                  >
                    <input
                      type="radio"
                      name="countryCode"
                      value={country.isoCode}
                      required
                      checked={countryCode === country.isoCode}
                      onChange={() => setCountryCode(country.isoCode)}
                      className="accent-primary size-4 shrink-0"
                    />
                    <span className="flex-1">{country.name}</span>
                    <span className="text-fg-muted text-sm">
                      in {examLanguageList(country.examLanguages)}
                    </span>
                  </label>
                </li>
              ))}
              {visible.length === 0 && (
                <li className="text-fg-muted px-4 py-6 text-center">
                  No country matches “{query}”. Oathly adds countries as it verifies their exams.
                </li>
              )}
            </ul>
          </div>
          {/* Decoration: the list is the way to choose. Clicking a country on the globe picks it too. */}
          <div data-theme="dark" className="bg-canvas hidden rounded-xl p-2 sm:block">
            <GlobeSlot
              scene="picker"
              view={HERO_VIEW}
              markers={markers}
              focus={countryCode || null}
              onSelect={setCountryCode}
            >
              <GlobePoster
                view={HERO_VIEW}
                markers={markers}
                focus={countryCode || null}
                sizes="14rem"
              />
            </GlobeSlot>
          </div>
        </div>
      </fieldset>

      <div>
        <label htmlFor="examDate" className="font-display block text-xl font-medium">
          When is your exam? <span className="text-fg-muted text-base font-normal">(optional)</span>
        </label>
        <p className="text-fg-muted mt-1 text-sm">We use it to pace your study plan.</p>
        <input
          id="examDate"
          name="examDate"
          type="date"
          min={isoDate(new Date())}
          className={`${fieldClass} mt-3 max-w-xs`}
        />
      </div>

      <div>
        <label htmlFor="studyLocale" className="font-display block text-xl font-medium">
          Which language do you want to study in?
        </label>
        <p className="text-fg-muted mt-1 text-sm">
          Questions appear in this language where a checked translation exists, and in the exam’s
          language otherwise.
        </p>
        <select
          id="studyLocale"
          name="studyLocale"
          defaultValue={defaultLocale}
          className={`${fieldClass} mt-3 max-w-sm`}
        >
          {studyLocales.map((locale) => (
            <option key={locale} value={locale} lang={locale}>
              {endonym(locale)}
              {locale !== 'en' ? ` (${languageName(locale, 'en')})` : ''}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="font-display text-xl font-medium">
          How long can you study each day?
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {dailyGoalOptions.map((minutes) => (
            <label key={minutes} className="cursor-pointer">
              <input
                type="radio"
                name="dailyGoalMinutes"
                value={minutes}
                defaultChecked={minutes === defaultDailyGoal}
                className="peer sr-only"
              />
              <span
                className={`border-border-strong peer-checked:bg-primary peer-checked:text-on-primary peer-checked:border-primary peer-focus-visible:outline-focus-ring block rounded-full border px-4 py-2 font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${focusRing}`}
              >
                {minutes} min
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {adding ? (
        <label className="flex items-center gap-3">
          <input type="checkbox" name="makePrimary" className="accent-primary size-4" />
          Make this the exam the app opens on
        </label>
      ) : (
        <input type="hidden" name="makePrimary" value="on" />
      )}

      <button type="submit" disabled={pending} className={buttonClass.primary}>
        {adding ? 'Add this country' : 'Start studying'}
      </button>
    </form>
  );
}
