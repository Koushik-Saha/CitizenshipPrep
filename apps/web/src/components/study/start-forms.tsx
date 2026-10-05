'use client';

import type { CountryDashboard } from '@oathly/api';
import { useActionState } from 'react';

import {
  startMockExamSession,
  startPracticeSession,
  type StartState,
} from '@/app/[locale]/study/actions';
import { useT } from '@/components/i18n/provider';
import { buttonClass, fieldClass, labelClass, Notice } from '@/components/ui';

const initial: StartState = { error: null };

export function PracticeForm({ country }: { country: CountryDashboard }) {
  const t = useT();
  const [state, action, pending] = useActionState(startPracticeSession, initial);
  const id = country.countryCode;
  return (
    <form action={action} className="space-y-3">
      {state.error && (
        <Notice tone="error" role="alert">
          {state.error}
        </Notice>
      )}
      <input type="hidden" name="countryCode" value={id} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor={`focus-${id}`} className={labelClass}>
            {t('start.questionsFrom')}
          </label>
          <select id={`focus-${id}`} name="focus" defaultValue="adaptive" className={fieldClass}>
            <option value="adaptive">
              {country.dueForReview > 0
                ? t('start.adaptiveDue', { count: country.dueForReview })
                : t('start.adaptive')}
            </option>
            <option value="random">{t('start.random')}</option>
            {country.topics.map((topic) => (
              <option key={topic.topicId} value={`topic:${topic.topicId}`}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`size-${id}`} className={labelClass}>
            {t('start.howMany')}
          </label>
          <select id={`size-${id}`} name="size" defaultValue="10" className={fieldClass}>
            {[5, 10, 20, 30].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="kind"
          value="practice"
          disabled={pending}
          className={buttonClass.primary}
        >
          {t('dashboard.practise')}
        </button>
        <button
          type="submit"
          name="kind"
          value="flashcards"
          disabled={pending}
          className={buttonClass.secondary}
        >
          {t('start.flashcards')}
        </button>
      </div>
    </form>
  );
}

export function MockExamForm({ country }: { country: CountryDashboard }) {
  const t = useT();
  const [state, action, pending] = useActionState(startMockExamSession, initial);
  return (
    <form action={action} className="space-y-3">
      {state.error && (
        <Notice tone="error" role="alert">
          {state.error}
        </Notice>
      )}
      <input type="hidden" name="countryCode" value={country.countryCode} />
      <ul className="space-y-2">
        {country.exams.map((exam) => (
          <li
            key={exam.id}
            className="border-border flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3"
          >
            <div>
              <p className="font-medium">{exam.name}</p>
              <p className="text-fg-muted text-sm">
                {[
                  t('exam.questionCount', { count: exam.questionCount }),
                  exam.passMark !== null ? t('exam.toPass', { count: exam.passMark }) : null,
                  exam.timeLimitMinutes !== null
                    ? t('exam.minutes', { count: exam.timeLimitMinutes })
                    : t('exam.noTimeLimit'),
                ]
                  .filter((part) => part !== null)
                  .join(t('exam.factSeparator'))}
              </p>
              {exam.unavailableReason && (
                <p className="text-fg-subtle text-sm">{exam.unavailableReason}</p>
              )}
            </div>
            <button
              type="submit"
              name="examFormatId"
              value={exam.id}
              disabled={pending || exam.unavailableReason !== null}
              className={buttonClass.secondary}
            >
              {t('start.startMock')}
            </button>
          </li>
        ))}
      </ul>
    </form>
  );
}

/** One-click start for a "what to study next" suggestion. */
export function QuickStart({
  countryCode,
  label,
  focus,
  examFormatId,
}: {
  countryCode: string;
  label: string;
  /** Practice focus: 'adaptive', 'random' or 'topic:<id>'. Leave out for a mock exam. */
  focus?: string;
  examFormatId?: string;
}) {
  const [state, action, pending] = useActionState(
    examFormatId ? startMockExamSession : startPracticeSession,
    initial,
  );
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="countryCode" value={countryCode} />
      {focus && <input type="hidden" name="focus" value={focus} />}
      {focus && <input type="hidden" name="size" value="10" />}
      {examFormatId && <input type="hidden" name="examFormatId" value={examFormatId} />}
      <button
        type="submit"
        name="kind"
        value="practice"
        disabled={pending}
        className={buttonClass.secondary}
      >
        {label}
      </button>
      {state.error && <p className="text-error-fg mt-1 text-sm">{state.error}</p>}
    </form>
  );
}
