import { daysUntilExam, nextStep } from '@oathly/api';
import { endonym } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { Badge, buttonClass, focusRing } from '@/components/ui';
import { requireMe } from '@/lib/user';

import { stopStudying } from '../onboarding/actions';

export const metadata: Metadata = { title: 'Your study plan | Oathly' };

function examCountdown(days: number | null): string {
  if (days === null) return 'No exam date set';
  if (days < 0) return 'Exam date has passed';
  if (days === 0) return 'Exam today';
  return days === 1 ? 'Exam tomorrow' : `Exam in ${days} days`;
}

export default async function Study() {
  const { user, me } = await requireMe();
  if (nextStep(me) === 'onboarding') redirect('/onboarding');
  const accuracy = me.progress.questionsAnswered
    ? Math.round((me.progress.correctAnswers / me.progress.questionsAnswered) * 100)
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">
            {me.profile.displayName ? `Hi, ${me.profile.displayName}` : 'Your study plan'}
          </h1>
          <p className="text-fg-muted mt-2">
            {me.settings?.dailyGoalMinutes} minutes a day
            {user.email ? `. Signed in as ${user.email}` : ''}.
          </p>
        </div>
        <SignOutButton />
      </div>

      <section aria-labelledby="exams" className="mt-10">
        <h2 id="exams" className="font-display text-2xl font-medium">
          Your exams
        </h2>
        <ul className="mt-4 space-y-3">
          {me.studyCountries.map((country) => (
            <li
              key={country.countryCode}
              className="bg-surface border-border rounded-lg border p-5"
            >
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-medium">{country.countryName}</h3>
                {country.isPrimary && <Badge>Opens first</Badge>}
              </div>
              <p className="text-fg-muted mt-1">
                {examCountdown(daysUntilExam(country))}
                {country.studyLocale ? `. Studying in ${endonym(country.studyLocale)}` : ''}.
              </p>
              {me.studyCountries.length > 1 && (
                <form action={stopStudying.bind(null, country.countryCode)} className="mt-3">
                  <button
                    type="submit"
                    className={`${focusRing} text-error-fg rounded-xs text-sm underline`}
                  >
                    Stop studying for this exam
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <Link href="/onboarding?add=1" className={`${buttonClass.secondary} mt-4`}>
          Add another exam
        </Link>
      </section>

      <section aria-labelledby="progress" className="mt-12">
        <h2 id="progress" className="font-display text-2xl font-medium">
          Progress
        </h2>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          {[
            ['Sessions', me.progress.attempts],
            ['Questions answered', me.progress.questionsAnswered],
            ['Correct', accuracy === null ? '–' : `${accuracy}%`],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface border-border rounded-lg border p-4">
              <dt className="text-fg-muted text-sm">{label}</dt>
              <dd className="font-display mt-1 text-3xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
