import { sortLearners } from '@oathly/api/org';
import { getOrgReport } from '@oathly/api/server';
import { countryName, localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';

import { OrgLogo } from '@/components/org/brand';
import { PrintButton } from '@/components/org/print-button';
import { focusRing } from '@/components/ui';
import { getDb } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { logoSrc, requireOrgAdmin } from '@/lib/org';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/org/[slug]/report'>): Promise<Metadata> {
  const { t } = await getT(params);
  return { title: t('org.reportTitle'), robots: { index: false } };
}

const standingLabel = {
  ready: 'org.standingReady',
  on_track: 'org.standingOnTrack',
  behind: 'org.standingBehind',
  not_started: 'org.standingNotStarted',
} as const;

// The report laid out for paper. The browser's own "Save as PDF" makes the
// file, so names print in whatever script they are written in, right to left
// where the language is, with no fonts to ship.
export default async function OrgReportPage({ params }: PageProps<'/[locale]/org/[slug]/report'>) {
  const { locale, t } = await getT(params);
  const { slug } = await params;
  const { user, access } = await requireOrgAdmin(locale, slug);
  const report = await getOrgReport(getDb(), user.userId, access.organization.id);
  const { organization, summary } = report;
  const learners = sortLearners(report.learners, 'attention');
  const logo = logoSrc(organization);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const cell = 'border-border border-b px-2 py-1.5 align-top';

  return (
    // Paper is white whatever theme the screen is in.
    <main data-theme="light" className="bg-surface text-fg min-h-screen px-4 py-8 print:p-0">
      <style>{'@page { size: A4 landscape; margin: 12mm; }'}</style>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <Link
            href={localizePath(locale, `/org/${organization.slug}`)}
            className={`${focusRing} text-primary-fg rounded-xs text-sm underline`}
          >
            {t('org.reportBack')}
          </Link>
          <PrintButton label={t('org.exportPdf')} />
        </div>

        <header className="flex flex-wrap items-center gap-4">
          {logo && <OrgLogo src={logo} className="h-12" />}
          <div>
            <h1 className="font-display text-3xl font-semibold">{t('org.reportTitle')}</h1>
            <p className="text-fg-muted">
              {organization.name}
              {' · '}
              {t('org.reportGenerated', {
                date: new Intl.DateTimeFormat(locale, {
                  dateStyle: 'long',
                  timeStyle: 'short',
                }).format(new Date(report.generatedAt)),
              })}
            </p>
          </div>
        </header>

        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-2">
          {(
            [
              [t('org.learners'), summary.learners],
              [t('org.summaryReady'), summary.ready],
              [t('org.summaryBehind'), summary.behind],
              [t('org.summaryActive'), summary.activeThisWeek],
              [t('org.summaryAverage'), summary.averageReadiness ?? '–'],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-fg-muted text-sm">{label}</dt>
              <dd className="font-display text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <table className="mt-6 w-full text-start text-sm print:text-xs">
          <thead>
            <tr>
              {[
                t('org.colLearner'),
                t('org.colCountry'),
                t('org.colTargetDate'),
                t('org.colReadiness'),
                t('org.colStanding'),
                t('org.colLastActive'),
                t('org.colAnswersWeek'),
                t('org.colAnswers'),
                t('org.colMockExams'),
                t('org.colLastMock'),
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="border-fg border-b px-2 py-1.5 text-start font-semibold"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {learners.map((learner) => (
              <tr key={learner.userId} className="break-inside-avoid">
                <th scope="row" className={`${cell} text-start font-normal`}>
                  <span className="block font-semibold" dir="auto">
                    {learner.name ?? learner.email ?? '–'}
                  </span>
                  {learner.name && learner.email && (
                    <span className="text-fg-muted block" dir="ltr">
                      {learner.email}
                    </span>
                  )}
                </th>
                <td className={cell}>
                  {learner.countryCode
                    ? countryName(
                        learner.countryCode,
                        locale,
                        learner.countryName ?? learner.countryCode,
                      )
                    : '–'}
                </td>
                <td className={cell}>
                  {learner.targetDate
                    ? date.format(new Date(`${learner.targetDate}T00:00:00Z`))
                    : '–'}
                </td>
                <td className={`${cell} tabular-nums`}>
                  {learner.readiness !== null && learner.questionsSeen > 0
                    ? learner.readiness
                    : '–'}
                </td>
                <td className={cell}>{t(standingLabel[learner.standing])}</td>
                <td className={cell}>
                  {learner.lastActiveAt
                    ? when.format(new Date(learner.lastActiveAt))
                    : t('org.never')}
                </td>
                <td className={`${cell} tabular-nums`}>{learner.answersThisWeek}</td>
                <td className={`${cell} tabular-nums`}>{learner.answers}</td>
                <td className={`${cell} tabular-nums`}>{learner.mockExams}</td>
                <td className={`${cell} tabular-nums`}>{learner.lastMockPercent ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-fg-muted mt-6 text-xs">{t('org.readinessNote')}</p>
        <p className="text-fg-muted mt-1 text-xs">{t('common.notAffiliated')}</p>
      </div>
    </main>
  );
}
