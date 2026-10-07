'use client';

import type { ExamCountry } from '@oathly/api';
import { dailyGoalOptions, isoDate } from '@oathly/api/onboarding-options';
import { searchCountries } from '@oathly/api/country-search';
import { countryName, endonym, languageList, languageName, studyLocales } from '@oathly/i18n';
import { useActionState, useId, useState } from 'react';

import { GlobePoster } from '@/components/globe/globe-poster';
import { GlobeSlot } from '@/components/globe/globe-slot';
import { HERO_VIEW } from '@/components/globe/config';
import type { GlobeMarker } from '@/components/globe/scene-store';
import { useT } from '@/components/i18n/provider';
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
  /** A target date an organization set with its invitation (YYYY-MM-DD). */
  defaultExamDate?: string | null;
}

const initialState: OnboardingState = { error: null };

export function OnboardingForm({
  countries,
  preselected,
  markers,
  adding,
  defaultLocale,
  defaultDailyGoal,
  defaultExamDate,
}: Props) {
  const t = useT();
  const [state, action, pending] = useActionState(completeOnboarding, initialState);
  const [query, setQuery] = useState('');
  const [countryCode, setCountryCode] = useState(
    preselected ?? (countries.length === 1 ? countries[0]!.isoCode : ''),
  );
  const searchId = useId();

  // Listed and searched under the names the reader knows them by.
  const named = countries.map((country) => ({
    ...country,
    name: countryName(country.isoCode, t.locale, country.name),
  }));
  const visible = searchCountries(named, query);

  return (
    <form action={action} className="space-y-10">
      {state.error && (
        <Notice tone="error" role="alert">
          {state.error}
        </Notice>
      )}

      <fieldset>
        <legend className="font-display text-xl font-medium">{t('onboarding.whichExam')}</legend>
        <div className="mt-4 grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <div>
            <label htmlFor={searchId} className={`${labelClass} mt-4`}>
              {t('onboarding.searchCountries')}
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
                ? t('onboarding.countryCount', { count: countries.length })
                : t('onboarding.countryCountFiltered', {
                    shown: visible.length,
                    total: countries.length,
                  })}
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
                      {t('onboarding.inLanguages', {
                        languages: languageList(country.examLanguages, t.locale),
                      })}
                    </span>
                  </label>
                </li>
              ))}
              {visible.length === 0 && (
                <li className="text-fg-muted px-4 py-6 text-center">
                  {t('onboarding.noCountryMatch', { query })}
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
          {t('onboarding.examDate')}{' '}
          <span className="text-fg-muted text-base font-normal">{t('onboarding.optional')}</span>
        </label>
        <p className="text-fg-muted mt-1 text-sm">{t('onboarding.examDateHint')}</p>
        <input
          id="examDate"
          name="examDate"
          type="date"
          defaultValue={defaultExamDate ?? undefined}
          min={isoDate(new Date())}
          className={`${fieldClass} mt-3 max-w-xs`}
        />
      </div>

      <div>
        <label htmlFor="studyLocale" className="font-display block text-xl font-medium">
          {t('onboarding.studyLanguage')}
        </label>
        <p className="text-fg-muted mt-1 text-sm">{t('onboarding.studyLanguageHint')}</p>
        <select
          id="studyLocale"
          name="studyLocale"
          defaultValue={defaultLocale}
          className={`${fieldClass} mt-3 max-w-sm`}
        >
          {studyLocales.map((locale) => (
            <option key={locale} value={locale} lang={locale}>
              {endonym(locale)}
              {locale !== t.locale ? ` (${languageName(locale, t.locale)})` : ''}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="font-display text-xl font-medium">{t('onboarding.dailyGoal')}</legend>
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
                {t('onboarding.minutesShort', { count: minutes })}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {adding ? (
        <label className="flex items-center gap-3">
          <input type="checkbox" name="makePrimary" className="accent-primary size-4" />
          {t('onboarding.makePrimary')}
        </label>
      ) : (
        <input type="hidden" name="makePrimary" value="on" />
      )}

      <button type="submit" disabled={pending} className={buttonClass.primary}>
        {adding ? t('onboarding.add') : t('onboarding.start')}
      </button>
    </form>
  );
}
