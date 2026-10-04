'use client';

import { useDashboard } from '@oathly/api/hooks';
import { daysUntilExam } from '@oathly/api/me';
import Link from 'next/link';

import { stopStudying } from '@/app/onboarding/actions';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Badge, buttonClass, focusRing } from '@/components/ui';

import { ReadinessPanel } from './readiness-gauge';
import { MockExamForm, PracticeForm } from './start-forms';
import { TimeZoneSync } from './time-zone-sync';

function countdown(days: number | null): string {
  if (days === null) return 'No exam date set';
  if (days < 0) return 'Exam date has passed';
  if (days === 0) return 'Exam today';
  return days === 1 ? 'Exam tomorrow' : `Exam in ${days} days`;
}

/**
 * The dashboard, drawn from the query cache: the server seeds it, a return
 * visit shows what is cached at once, and anything older than half a minute
 * is refreshed in the background (stale-while-revalidate).
 */
export function DashboardView({
  displayName,
  timeZone,
}: {
  displayName: string | null;
  timeZone: string;
}) {
  const { data: dashboard } = useDashboard();
  // The server always seeds the cache; this only guards a cleared cache.
  if (!dashboard) return null;
  const goalProgress = Math.min(
    100,
    Math.round((dashboard.minutesToday / dashboard.dailyGoalMinutes) * 100),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <TimeZoneSync current={timeZone} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold">
          {displayName ? `Hi, ${displayName}` : 'Your study'}
        </h1>
        <SignOutButton />
      </div>

      <dl className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="bg-surface border-border rounded-lg border p-5">
          <dt className="text-fg-muted text-sm">Today’s goal</dt>
          <dd className="mt-1">
            <span className="font-display text-3xl font-semibold">{dashboard.minutesToday}</span>
            <span className="text-fg-muted"> of {dashboard.dailyGoalMinutes} minutes</span>
            <div
              className="bg-surface-sunken mt-3 h-2 overflow-hidden rounded-full"
              role="progressbar"
              aria-label="Today’s goal"
              aria-valuenow={goalProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="bg-success h-full" style={{ width: `${goalProgress}%` }} />
            </div>
          </dd>
        </div>
        <div className="bg-surface border-border rounded-lg border p-5">
          <dt className="text-fg-muted text-sm">Study streak</dt>
          <dd className="mt-1">
            <span className="font-display text-3xl font-semibold">{dashboard.streakDays}</span>
            <span className="text-fg-muted">
              {' '}
              {dashboard.streakDays === 1 ? 'day' : 'days'} in a row
            </span>
          </dd>
        </div>
      </dl>

      {dashboard.countries.map((country) => (
        <section
          key={country.countryCode}
          aria-labelledby={`country-${country.countryCode}`}
          className="mt-12"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id={`country-${country.countryCode}`}
              className="font-display text-3xl font-semibold"
            >
              {country.countryName}
            </h2>
            {country.isPrimary && <Badge>Opens first</Badge>}
          </div>
          <p className="text-fg-muted mt-1">
            {countdown(daysUntilExam({ ...country, studyLocale: null }))}.{' '}
            {country.publishedQuestions} questions ready to study.
          </p>

          {country.publishedQuestions === 0 ? (
            <p className="border-border text-fg-muted mt-6 rounded-lg border border-dashed px-6 py-8">
              Questions for {country.countryName} are still being checked against the official
              guide. They appear here once a reviewer has verified them.
            </p>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <ReadinessPanel countryCode={country.countryCode} readiness={country.readiness!} />
              <div className="space-y-6">
                <div className="bg-surface border-border rounded-lg border p-5">
                  <h3 className="mb-3 font-medium">Practise</h3>
                  <PracticeForm country={country} />
                </div>
                <div className="bg-surface border-border rounded-lg border p-5">
                  <h3 className="mb-3 font-medium">Mock exam</h3>
                  <MockExamForm country={country} />
                </div>
                <Link
                  href={`/study/tutor/${country.countryCode.toLowerCase()}`}
                  prefetch
                  className={`${buttonClass.secondary} w-full`}
                >
                  Ask the tutor about {country.countryName}
                </Link>
              </div>
            </div>
          )}
          {dashboard.countries.length > 1 && (
            <form action={stopStudying.bind(null, country.countryCode)} className="mt-4">
              <button
                type="submit"
                className={`${focusRing} text-error-fg rounded-xs text-sm underline`}
              >
                Stop studying for this exam
              </button>
            </form>
          )}
        </section>
      ))}

      <Link href="/onboarding?add=1" className={`${buttonClass.secondary} mt-12`}>
        Add another exam
      </Link>
    </main>
  );
}
