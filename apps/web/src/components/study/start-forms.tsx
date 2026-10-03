'use client';

import type { CountryDashboard } from '@oathly/api';
import { useActionState } from 'react';

import { buttonClass, fieldClass, labelClass, Notice } from '@/components/ui';
import { startMockExamSession, startPracticeSession, type StartState } from '@/app/study/actions';

const initial: StartState = { error: null };

export function PracticeForm({ country }: { country: CountryDashboard }) {
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
            Questions from
          </label>
          <select
            id={`focus-${id}`}
            name="focus"
            defaultValue={country.dueForReview > 0 ? 'weak' : 'random'}
            className={fieldClass}
          >
            <option value="weak">
              My weak areas
              {country.dueForReview > 0 ? ` (${country.dueForReview} due for review)` : ''}
            </option>
            <option value="random">All topics, mixed</option>
            {country.topics.map((topic) => (
              <option key={topic.topicId} value={`topic:${topic.topicId}`}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`size-${id}`} className={labelClass}>
            How many
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
          Practise
        </button>
        <button
          type="submit"
          name="kind"
          value="flashcards"
          disabled={pending}
          className={buttonClass.secondary}
        >
          Flashcards
        </button>
      </div>
    </form>
  );
}

export function MockExamForm({ country }: { country: CountryDashboard }) {
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
                {exam.questionCount} questions
                {exam.passMark !== null ? `, ${exam.passMark} to pass` : ''}
                {exam.timeLimitMinutes !== null
                  ? `, ${exam.timeLimitMinutes} minutes`
                  : ', no time limit'}
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
              Start mock exam
            </button>
          </li>
        ))}
      </ul>
    </form>
  );
}
