'use client';

import { useReportExamResult } from '@oathly/api/hooks';
import type { CountryDashboard } from '@oathly/api/study';

import { useT } from '@/components/i18n/provider';
import { buttonClass } from '@/components/ui';

/**
 * Once the exam's date has come: asks how it went, and afterwards says what
 * the learner told us. Nothing is shown before the date.
 */
export function ExamResult({
  country,
  name,
}: {
  country: Pick<CountryDashboard, 'countryCode' | 'examResult' | 'askExamResult'>;
  /** The country's name in the reader's language. */
  name: string;
}) {
  const t = useT();
  const report = useReportExamResult();
  const say = (result: 'passed' | 'failed') =>
    report.mutate({ countryCode: country.countryCode, result });

  if (country.askExamResult) {
    return (
      <div
        className="bg-accent-soft border-border mt-4 rounded-lg border p-5"
        data-testid={`exam-result-ask-${country.countryCode}`}
      >
        <p className="font-medium" id={`exam-result-${country.countryCode}`}>
          {t('dashboard.examResultAsk', { country: name })}
        </p>
        <div
          role="group"
          aria-labelledby={`exam-result-${country.countryCode}`}
          className="mt-3 flex flex-wrap gap-3"
        >
          <button
            type="button"
            className={buttonClass.primary}
            disabled={report.isPending}
            onClick={() => say('passed')}
          >
            {t('dashboard.examResultPassed')}
          </button>
          <button
            type="button"
            className={buttonClass.secondary}
            disabled={report.isPending}
            onClick={() => say('failed')}
          >
            {t('dashboard.examResultFailed')}
          </button>
        </div>
        {report.isError && (
          <p role="alert" className="text-error-fg mt-3 text-sm">
            {t('dashboard.examResultError')}
          </p>
        )}
      </div>
    );
  }
  if (!country.examResult) return null;
  return (
    <p
      role="status"
      className={`mt-4 rounded-lg p-4 font-medium ${
        country.examResult === 'passed' ? 'bg-success-soft text-success-fg' : 'bg-surface-sunken'
      }`}
      data-testid={`exam-result-${country.examResult}-${country.countryCode}`}
    >
      {country.examResult === 'passed'
        ? t('dashboard.examResultCongrats', { country: name })
        : t('dashboard.examResultRetake')}
    </p>
  );
}
