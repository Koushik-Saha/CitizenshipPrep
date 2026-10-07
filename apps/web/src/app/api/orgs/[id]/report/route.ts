import { reportColumns, reportRow, sortLearners, type ReportColumn } from '@oathly/api/org';
import { getOrgReport, OrgError } from '@oathly/api/server';
import { toCsv } from '@oathly/core';
import { countryName, isUiLocale } from '@oathly/i18n';
import { translatorFor } from '@oathly/i18n/messages';

import { apiUserId, jsonError } from '@/lib/api-auth';
import { getDb } from '@/lib/db';

const heading = {
  name: 'org.colLearner',
  email: 'org.colEmail',
  country: 'org.colCountry',
  targetDate: 'org.colTargetDate',
  daysLeft: 'org.colDaysLeft',
  readiness: 'org.colReadiness',
  standing: 'org.colStanding',
  lastActive: 'org.colLastActive',
  answersThisWeek: 'org.colAnswersWeek',
  minutesThisWeek: 'org.colMinutesWeek',
  answers: 'org.colAnswers',
  mockExams: 'org.colMockExams',
  lastMock: 'org.colLastMock',
  joined: 'org.colJoined',
} as const satisfies Record<ReportColumn, string>;

const standingLabel = {
  ready: 'org.standingReady',
  on_track: 'org.standingOnTrack',
  behind: 'org.standingBehind',
  not_started: 'org.standingNotStarted',
} as const;

// GET /api/orgs/<id>/report?locale=<ui locale>: the organization's learners
// as a CSV file, for its admins only. Headings are in the language asked
// for; dates are YYYY-MM-DD so a spreadsheet sorts them.
export async function GET(request: Request, { params }: RouteContext<'/api/orgs/[id]/report'>) {
  const userId = await apiUserId(request);
  if (!userId) return jsonError('Sign in to continue.', 401);
  const { id } = await params;
  const asked = new URL(request.url).searchParams.get('locale') ?? 'en';
  const t = translatorFor(isUiLocale(asked) ? asked : 'en');

  let report;
  try {
    report = await getOrgReport(getDb(), userId, id);
  } catch (error) {
    if (!(error instanceof OrgError)) throw error;
    // The same answer whether it does not exist or is not theirs to read.
    return jsonError('Not found.', error.problem === 'forbidden' ? 403 : 404);
  }

  const rows = sortLearners(report.learners, 'name').map((learner) => {
    const row = reportRow(learner, (standing) => t(standingLabel[standing]));
    if (learner.countryCode) {
      row.country = countryName(learner.countryCode, t.locale, learner.countryName ?? '');
    }
    return reportColumns.map((column) => row[column]);
  });
  const csv = toCsv([reportColumns.map((column) => t(heading[column])), ...rows]);
  const day = report.generatedAt.slice(0, 10);
  // The byte-order mark tells Excel the file is UTF-8, so names keep their letters.
  return new Response(`\uFEFF${csv}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${report.organization.slug}-learners-${day}.csv"`,
      'cache-control': 'private, no-store',
    },
  });
}
