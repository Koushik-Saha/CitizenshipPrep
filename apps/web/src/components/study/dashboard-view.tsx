'use client';

import { useDashboard } from '@oathly/api/hooks';
import { daysUntilExam } from '@oathly/api/me';
import { countryName, type Translator } from '@oathly/i18n';

import { stopStudying } from '@/app/[locale]/onboarding/actions';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { LanguageMenu } from '@/components/i18n/language-menu';
import { useT } from '@/components/i18n/provider';
import Link from '@/components/link';
import { Badge, buttonClass, focusRing } from '@/components/ui';

import { ExamResult } from './exam-result';
import { ReadinessPanel } from './readiness-gauge';
import { MockExamForm, PracticeForm } from './start-forms';
import { TimeZoneSync } from './time-zone-sync';

function countdown(days: number | null, t: Translator): string {
  if (days === null) return t('exam.countdownNone');
  if (days < 0) return t('exam.countdownPassed');
  if (days === 0) return t('exam.countdownToday');
  return t('exam.countdownDays', { count: days });
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
  const t = useT();
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
          {displayName ? t('dashboard.greeting', { name: displayName }) : t('dashboard.title')}
        </h1>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link
            href="/study/plans"
            prefetch
            className={`${focusRing} text-fg-muted hover:text-fg rounded-xs`}
          >
            {t('plans.title')}
          </Link>
          <LanguageMenu locale={t.locale} label={t('common.language')} path="/study" />
          <SignOutButton />
        </div>
      </div>

      <dl className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="bg-surface border-border rounded-lg border p-5">
          <dt className="text-fg-muted text-sm">{t('dashboard.todaysGoal')}</dt>
          <dd className="mt-1">
            <span className="font-display text-3xl font-semibold">{dashboard.minutesToday}</span>
            <span className="text-fg-muted">
              {' '}
              {t('dashboard.goalProgress', { goal: dashboard.dailyGoalMinutes })}
            </span>
            <div
              className="bg-surface-sunken mt-3 h-2 overflow-hidden rounded-full"
              role="progressbar"
              aria-label={t('dashboard.todaysGoal')}
              aria-valuenow={goalProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="bg-success h-full" style={{ width: `${goalProgress}%` }} />
            </div>
          </dd>
        </div>
        <div className="bg-surface border-border rounded-lg border p-5">
          <dt className="text-fg-muted text-sm">{t('dashboard.streak')}</dt>
          <dd className="mt-1">
            <span className="font-display text-3xl font-semibold">{dashboard.streakDays}</span>
            <span className="text-fg-muted">
              {' '}
              {t('dashboard.streakDays', { count: dashboard.streakDays })}
            </span>
          </dd>
        </div>
      </dl>

      {dashboard.countries.map((country) => {
        const name = countryName(country.countryCode, t.locale, country.countryName);
        return (
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
                {name}
              </h2>
              {country.isPrimary && <Badge>{t('dashboard.opensFirst')}</Badge>}
            </div>
            <p className="text-fg-muted mt-1">
              {countdown(daysUntilExam(country), t)}
              {' · '}
              {t('dashboard.questionsReady', { count: country.publishedQuestions })}
            </p>

            <ExamResult country={country} name={name} />

            {!country.fullAccess && country.totalQuestions > country.publishedQuestions && (
              // On the Free plan, and there is more to this country than its sample.
              <p className="mt-2 text-sm" data-testid={`free-limit-${country.countryCode}`}>
                {t('plans.freeLimit', {
                  available: country.publishedQuestions,
                  total: country.totalQuestions,
                })}{' '}
                <Link
                  href="/study/plans"
                  prefetch
                  className={`${focusRing} text-primary-fg rounded-xs font-medium underline underline-offset-4`}
                >
                  {t('plans.seePlans')}
                </Link>
              </p>
            )}

            {country.publishedQuestions === 0 ? (
              <p className="border-border text-fg-muted mt-6 rounded-lg border border-dashed px-6 py-8">
                {t('dashboard.questionsBeingChecked', { country: name })}
              </p>
            ) : (
              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                <ReadinessPanel countryCode={country.countryCode} readiness={country.readiness!} />
                <div className="space-y-6">
                  <div className="bg-surface border-border rounded-lg border p-5">
                    <h3 className="mb-3 font-medium">{t('dashboard.practise')}</h3>
                    <PracticeForm country={country} />
                  </div>
                  <div className="bg-surface border-border rounded-lg border p-5">
                    <h3 className="mb-3 font-medium">{t('dashboard.mockExam')}</h3>
                    <MockExamForm country={country} />
                  </div>
                  <Link
                    href={`/study/tutor/${country.countryCode.toLowerCase()}`}
                    prefetch
                    className={`${buttonClass.secondary} w-full`}
                  >
                    {t('dashboard.askTutor', { country: name })}
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
                  {t('dashboard.stopStudying')}
                </button>
              </form>
            )}
          </section>
        );
      })}

      <Link href="/onboarding?add=1" className={`${buttonClass.secondary} mt-12`}>
        {t('dashboard.addExam')}
      </Link>
    </main>
  );
}
