import { daysUntilExam, nextStep } from '@oathly/api';
import { getDashboard } from '@oathly/api/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { MockExamForm, PracticeForm } from '@/components/study/start-forms';
import { TimeZoneSync } from '@/components/study/time-zone-sync';
import { Badge, buttonClass, focusRing } from '@/components/ui';
import { getDb } from '@/lib/db';
import { requireMe } from '@/lib/user';

import { stopStudying } from '../onboarding/actions';

export const metadata: Metadata = { title: 'Study | Oathly' };

function countdown(days: number | null): string {
  if (days === null) return 'No exam date set';
  if (days < 0) return 'Exam date has passed';
  if (days === 0) return 'Exam today';
  return days === 1 ? 'Exam tomorrow' : `Exam in ${days} days`;
}

export default async function StudyDashboard() {
  const { user, me } = await requireMe();
  if (nextStep(me) === 'onboarding') redirect('/onboarding');
  const dashboard = (await getDashboard(getDb(), user.userId))!;
  const timeZone =
    (
      await getDb().query<{ time_zone: string }>(
        'select time_zone from public.user_settings where user_id = $1',
        [user.userId],
      )
    ).rows[0]?.time_zone ?? 'UTC';
  const goalProgress = Math.min(
    100,
    Math.round((dashboard.minutesToday / dashboard.dailyGoalMinutes) * 100),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <TimeZoneSync current={timeZone} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold">
          {me.profile.displayName ? `Hi, ${me.profile.displayName}` : 'Your study'}
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
              <div className="bg-surface border-border rounded-lg border p-5">
                <h3 className="font-medium">Readiness</h3>
                <p className="mt-1">
                  <span className="font-display text-4xl font-semibold">
                    {country.readiness ?? 0}%
                  </span>
                </p>
                <p className="text-fg-muted text-sm">
                  How much of the question pool you know well right now.
                </p>
                <ul className="mt-4 space-y-3">
                  {country.topics.map((topic) => (
                    <li key={topic.topicId}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span>{topic.name}</span>
                        <span className="text-fg-muted">{topic.mastery}%</span>
                      </div>
                      <div
                        className="bg-surface-sunken mt-1 h-1.5 overflow-hidden rounded-full"
                        aria-hidden="true"
                      >
                        <div className="bg-primary h-full" style={{ width: `${topic.mastery}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
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
