'use client';

import { REPORT_DETAILS_MAX, questionReportReasons, type QuestionReportReason } from '@oathly/core';
import type { MessageKey } from '@oathly/i18n';
import { useId, useState } from 'react';

import { useT } from '@/components/i18n/provider';
import { buttonClass, fieldClass, focusRing } from '@/components/ui';

const reasonLabel: Record<QuestionReportReason, MessageKey> = {
  incorrect: 'report.incorrect',
  outdated: 'report.outdated',
  unclear: 'report.unclear',
  typo: 'report.typo',
};

type State =
  { step: 'closed' } | { step: 'open'; sending: boolean; failed: boolean } | { step: 'sent' };

/**
 * "Report a problem": a learner says what is wrong with a question, and it
 * goes to the reviewers. Shown with every question. `locale` is the language
 * the question is being read in, so a reviewer knows which wording was seen.
 */
export function ReportQuestion({ questionId, locale }: { questionId: string; locale: string }) {
  const t = useT();
  const name = useId();
  const [state, setState] = useState<State>({ step: 'closed' });
  const [reason, setReason] = useState<QuestionReportReason | null>(null);
  const [details, setDetails] = useState('');

  if (state.step === 'sent') {
    return (
      <p role="status" className="text-fg-muted mt-4 text-sm">
        {t('report.thanks')}
      </p>
    );
  }
  if (state.step === 'closed') {
    return (
      <p className="mt-4 text-sm">
        <button
          type="button"
          onClick={() => setState({ step: 'open', sending: false, failed: false })}
          className={`${focusRing} text-fg-muted hover:text-fg inline-flex min-h-11 items-center rounded-xs underline underline-offset-4`}
        >
          {t('report.open')}
        </button>
      </p>
    );
  }

  async function send() {
    if (!reason) return;
    setState({ step: 'open', sending: true, failed: false });
    try {
      const response = await fetch(`/api/questions/${questionId}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ reason, details, locale }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setState({ step: 'sent' });
    } catch {
      setState({ step: 'open', sending: false, failed: true });
    }
  }

  return (
    <form
      className="border-border mt-4 rounded-md border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <fieldset>
        <legend className="font-medium">{t('report.title')}</legend>
        <div className="mt-3 space-y-2">
          {questionReportReasons.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name={name}
                value={option}
                checked={reason === option}
                onChange={() => setReason(option)}
                required
                className="accent-primary size-4"
              />
              {t(reasonLabel[option])}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`${name}-details`} className="mt-4 block text-sm font-medium">
        {t('report.details')}
      </label>
      <textarea
        id={`${name}-details`}
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        maxLength={REPORT_DETAILS_MAX}
        rows={3}
        dir="auto"
        className={`${fieldClass} mt-1`}
      />
      {state.failed && (
        <p role="alert" className="text-error-fg mt-3 text-sm">
          {t('report.failed')}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" disabled={!reason || state.sending} className={buttonClass.secondary}>
          {t('report.send')}
        </button>
        <button
          type="button"
          onClick={() => setState({ step: 'closed' })}
          className={`${focusRing} text-fg-muted hover:text-fg rounded-xs px-2 underline underline-offset-4`}
        >
          {t('report.cancel')}
        </button>
      </div>
    </form>
  );
}
