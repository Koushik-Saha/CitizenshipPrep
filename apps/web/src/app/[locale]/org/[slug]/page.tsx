import { learnerSorts, sortLearners, type LearnerSort, type OrgLearner } from '@oathly/api/org';
import { getOrgReport, getSeats, listExamCountries } from '@oathly/api/server';
import { countryName, localizePath, type Translator } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';

import { OrgHeader, ProblemNotice } from '@/components/org/org-chrome';
import { SeatSummary } from '@/components/org/seat-summary';
import { Badge, buttonClass, fieldClass, focusRing, labelClass } from '@/components/ui';
import { getDb } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { requireOrgAdmin } from '@/lib/org';

import { assign, remove } from '../actions';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/org/[slug]'>): Promise<Metadata> {
  return { title: (await getT(params)).t('org.metaTitle') };
}

const standingLabel = {
  ready: { message: 'org.standingReady', tone: 'success' },
  on_track: { message: 'org.standingOnTrack', tone: 'neutral' },
  behind: { message: 'org.standingBehind', tone: 'warning' },
  not_started: { message: 'org.standingNotStarted', tone: 'neutral' },
} as const;

const sortLabel = {
  attention: 'org.sortAttention',
  name: 'org.sortName',
  readiness: 'org.sortReadiness',
  date: 'org.sortDate',
  activity: 'org.sortActivity',
} as const;

function Readiness({ learner, t }: { learner: OrgLearner; t: Translator }) {
  if (learner.readiness === null || learner.questionsSeen === 0) {
    return <span className="text-fg-muted">{t('org.noScore')}</span>;
  }
  return (
    <div className="min-w-28">
      <span className="font-display text-xl font-semibold tabular-nums">{learner.readiness}</span>
      {learner.isEarlyEstimate && (
        <span className="text-fg-muted text-xs"> {t('org.earlyEstimate')}</span>
      )}
      {/* The number beside it says the same: the bar is for the eye only. */}
      <div className="bg-surface-sunken mt-1 h-1.5 overflow-hidden rounded-full" aria-hidden="true">
        <div className="bg-primary h-full" style={{ width: `${learner.readiness}%` }} />
      </div>
    </div>
  );
}

// The learners of an organization: how ready each is, who has gone quiet, and
// what each was asked to prepare for.
export default async function OrgLearners({
  params,
  searchParams,
}: PageProps<'/[locale]/org/[slug]'>) {
  const { locale, t } = await getT(params);
  const { slug } = await params;
  const { user, access } = await requireOrgAdmin(locale, slug);
  const { organization } = access;
  const query = await searchParams;
  const sort: LearnerSort = learnerSorts.find((option) => option === query.sort) ?? 'attention';

  const db = getDb();
  const [report, seats, countries] = await Promise.all([
    getOrgReport(db, user.userId, organization.id),
    getSeats(db, organization.id, access.granted),
    listExamCountries(db),
  ]);
  const learners = sortLearners(report.learners, sort);
  const { summary } = report;
  const base = localizePath(locale, `/org/${organization.slug}`);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const nameOf = (code: string, fallback: string | null) =>
    countryName(code, locale, fallback ?? code);
  const stat = 'bg-surface border-border rounded-lg border p-4';
  const cell = 'px-3 py-3 align-top';

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <OrgHeader t={t} organization={organization} current="learners" />
      <ProblemNotice t={t} problem={query.error} />

      <dl className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(
          [
            [t('org.learners'), summary.learners],
            [t('org.summaryReady'), summary.ready],
            [t('org.summaryBehind'), summary.behind],
            [t('org.summaryActive'), summary.activeThisWeek],
            [t('org.summaryAverage'), summary.averageReadiness ?? '–'],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className={stat}>
            <dt className="text-fg-muted text-sm">{label}</dt>
            <dd className="font-display mt-1 text-3xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <SeatSummary t={t} seats={seats} />
      </div>

      <section aria-labelledby="learners" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="learners" className="font-display text-2xl font-semibold">
            {t('org.learners')}
          </h2>
          {learners.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <a
                href={`/api/orgs/${organization.id}/report?locale=${locale}`}
                className={buttonClass.secondary}
                download
              >
                {t('org.exportCsv')}
              </a>
              <Link href={`${base}/report`} className={buttonClass.secondary}>
                {t('org.exportPdf')}
              </Link>
            </div>
          )}
        </div>

        {learners.length === 0 ? (
          <p className="border-border text-fg-muted mt-6 rounded-lg border border-dashed px-6 py-8">
            {t('org.noLearners')}{' '}
            <Link
              href={`${base}/invite`}
              prefetch
              className={`${focusRing} text-primary-fg rounded-xs font-medium underline underline-offset-4`}
            >
              {t('org.inviteTitle')}
            </Link>
          </p>
        ) : (
          <>
            <nav aria-label={t('org.sortBy')} className="mt-4 text-sm">
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <li className="text-fg-muted" aria-hidden="true">
                  {t('org.sortBy')}
                </li>
                {learnerSorts.map((option) => (
                  <li key={option}>
                    <Link
                      href={option === 'attention' ? base : `${base}?sort=${option}`}
                      aria-current={option === sort ? 'true' : undefined}
                      className={`${focusRing} rounded-xs ${
                        option === sort
                          ? 'text-fg font-semibold'
                          : 'text-primary-fg underline underline-offset-4'
                      }`}
                    >
                      {t(sortLabel[option])}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Wide tables scroll sideways inside their own region, reachable by keyboard. */}
            <div
              className={`${focusRing} border-border bg-surface mt-4 overflow-x-auto rounded-lg border`}
              role="region"
              aria-labelledby="learners"
              tabIndex={0}
            >
              <table className="w-full min-w-[56rem] text-start text-sm">
                <thead className="text-fg-muted border-border border-b text-start">
                  <tr>
                    {[
                      t('org.colLearner'),
                      t('org.colCountry'),
                      t('org.colTargetDate'),
                      t('org.colReadiness'),
                      t('org.colStanding'),
                      t('org.colLastActive'),
                      t('org.colThisWeek'),
                    ].map((heading) => (
                      <th key={heading} scope="col" className="px-3 py-3 text-start font-medium">
                        {heading}
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-3">
                      <span className="sr-only">{t('org.change')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {learners.map((learner) => {
                    const standing = standingLabel[learner.standing];
                    return (
                      <tr key={learner.userId}>
                        <th scope="row" className={`${cell} text-start font-normal`}>
                          {/* Names and addresses are in whatever script their owner writes. */}
                          <span className="block font-semibold" dir="auto">
                            {learner.name ?? learner.email ?? '–'}
                          </span>
                          {learner.name && learner.email && (
                            <span className="text-fg-muted block" dir="ltr">
                              {learner.email}
                            </span>
                          )}
                          {!learner.hasSeat && <Badge tone="warning">{t('org.noSeat')}</Badge>}
                        </th>
                        <td className={cell}>
                          {learner.countryCode ? (
                            nameOf(learner.countryCode, learner.countryName)
                          ) : (
                            <span className="text-fg-muted">{t('org.notAssigned')}</span>
                          )}
                        </td>
                        <td className={cell}>
                          {learner.targetDate ? (
                            <>
                              {date.format(new Date(`${learner.targetDate}T00:00:00Z`))}
                              <span className="text-fg-muted block">
                                {learner.daysLeft! < 0
                                  ? t('org.datePassed')
                                  : t('org.daysLeft', { count: learner.daysLeft! })}
                              </span>
                            </>
                          ) : (
                            <span className="text-fg-muted">{t('org.noDate')}</span>
                          )}
                        </td>
                        <td className={cell}>
                          <Readiness learner={learner} t={t} />
                        </td>
                        <td className={cell}>
                          <Badge tone={standing.tone}>{t(standing.message)}</Badge>
                        </td>
                        <td className={cell}>
                          {learner.lastActiveAt ? (
                            when.format(new Date(learner.lastActiveAt))
                          ) : (
                            <span className="text-fg-muted">{t('org.never')}</span>
                          )}
                        </td>
                        <td className={cell}>
                          {t('org.thisWeek', {
                            answers: learner.answersThisWeek,
                            minutes: learner.minutesThisWeek,
                          })}
                        </td>
                        <td className={cell}>
                          <details>
                            <summary
                              className={`${focusRing} text-primary-fg cursor-pointer rounded-xs font-medium`}
                            >
                              {t('org.change')}
                              <span className="sr-only">
                                : {learner.name ?? learner.email ?? ''}
                              </span>
                            </summary>
                            <form action={assign} className="mt-3 w-56 space-y-3">
                              <input type="hidden" name="organizationId" value={organization.id} />
                              <input type="hidden" name="userId" value={learner.userId} />
                              <div>
                                <label htmlFor={`country-${learner.userId}`} className={labelClass}>
                                  {t('org.colCountry')}
                                </label>
                                <select
                                  id={`country-${learner.userId}`}
                                  name="countryCode"
                                  defaultValue={learner.countryCode ?? ''}
                                  className={fieldClass}
                                >
                                  <option value="">{t('org.inviteNoCountry')}</option>
                                  {countries.map((country) => (
                                    <option key={country.isoCode} value={country.isoCode}>
                                      {nameOf(country.isoCode, country.name)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label htmlFor={`date-${learner.userId}`} className={labelClass}>
                                  {t('org.colTargetDate')}
                                </label>
                                <input
                                  id={`date-${learner.userId}`}
                                  name="targetDate"
                                  type="date"
                                  defaultValue={learner.targetDate ?? ''}
                                  className={fieldClass}
                                />
                              </div>
                              <button type="submit" className={buttonClass.primary}>
                                {t('org.save')}
                              </button>
                            </form>
                            <form action={remove} className="mt-3">
                              <input type="hidden" name="organizationId" value={organization.id} />
                              <input type="hidden" name="userId" value={learner.userId} />
                              <button
                                type="submit"
                                className={`${focusRing} text-error-fg rounded-xs text-sm underline underline-offset-4`}
                              >
                                {t('org.remove')}
                              </button>
                            </form>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-fg-muted mt-4 max-w-prose text-sm">{t('org.readinessNote')}</p>
          </>
        )}
      </section>

      <p className="text-fg-muted mt-10 text-sm">{t('common.notAffiliated')}</p>
    </main>
  );
}
