import type { ReadinessView } from '@oathly/api';

import { Badge } from '@/components/ui';

import { QuickStart } from './start-forms';

// A semicircle gauge that sweeps up to the score when the page loads, and
// the few things most worth studying next. Server-rendered: the sweep is a
// CSS animation (globals.css), switched off for reduced motion.

const ARC = 'M 16 104 A 88 88 0 0 1 192 104';

function Gauge({ score, early }: { score: number; early: boolean }) {
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-valuetext={`${score}%, estimated${early ? ', early estimate' : ''}`}
      aria-label="Estimated readiness"
      className="relative mx-auto w-full max-w-[16rem]"
    >
      <svg viewBox="0 0 208 116" className="w-full" aria-hidden="true">
        <path
          d={ARC}
          pathLength={100}
          fill="none"
          strokeWidth={14}
          strokeLinecap="round"
          className="stroke-surface-sunken"
        />
        <path
          d={ARC}
          pathLength={100}
          fill="none"
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray="100 100"
          // Nothing to draw at 0: a round cap would still show a dot.
          strokeDashoffset={score === 0 ? 100.5 : 100 - score}
          className="gauge-fill stroke-accent"
        />
      </svg>
      <p className="absolute inset-x-0 bottom-0 text-center">
        <span className="font-display text-5xl font-semibold tabular-nums">{score}</span>
        <span className="text-fg-muted text-xl">%</span>
      </p>
    </div>
  );
}

function suggestionText(suggestion: ReadinessView['suggestions'][number]): {
  title: string;
  detail: string;
} {
  switch (suggestion.kind) {
    case 'start':
      return {
        title: 'Start practising',
        detail: 'Your first set picks a mix of questions from every topic.',
      };
    case 'review':
      return {
        title: `Review ${suggestion.count} question${suggestion.count === 1 ? '' : 's'} you are about to forget`,
        detail: 'Answering them now, while they are due, is what makes them stick.',
      };
    case 'topic':
      return {
        title: suggestion.name,
        detail: `About ${suggestion.share}% of the exam, and you know ${suggestion.mastery}% of it well.`,
      };
    case 'mock':
      return {
        title: `Take a mock exam`,
        detail: `${suggestion.examName}, timed like the real one.`,
      };
  }
}

export function ReadinessPanel({
  countryCode,
  readiness,
}: {
  countryCode: string;
  readiness: ReadinessView;
}) {
  return (
    <div className="bg-surface border-border rounded-lg border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Estimated readiness</h3>
        {readiness.isEarlyEstimate && <Badge tone="warning">Early estimate</Badge>}
      </div>
      <div className="mt-4">
        <Gauge score={readiness.score} early={readiness.isEarlyEstimate} />
      </div>
      <p className="text-fg-muted mt-3 text-sm">
        {readiness.isEarlyEstimate
          ? `Based on ${readiness.questionsSeen} question${readiness.questionsSeen === 1 ? '' : 's'} so far. It settles as you practise more. `
          : ''}
        This is an estimate from your practice
        {readiness.mockAverage !== null ? ' and mock exams' : ''}
        {readiness.examName ? `, weighted like the ${readiness.examName}` : ''}. It is not a
        guarantee of your result, and it drops if you stop reviewing.
      </p>
      <dl className="text-fg-muted mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt>Topic knowledge</dt>
          <dd className="text-fg font-medium">{readiness.knowledge}%</dd>
        </div>
        <div>
          <dt>Recent mock exams</dt>
          <dd className="text-fg font-medium">
            {readiness.mockAverage === null ? 'None yet' : `${readiness.mockAverage}% right`}
          </dd>
        </div>
      </dl>

      <h4 className="mt-6 font-medium">What to study next</h4>
      {readiness.suggestions.length === 0 ? (
        <p className="text-fg-muted mt-2 text-sm">
          Nothing stands out. Keep your daily practice going.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {readiness.suggestions.map((suggestion, index) => {
            const text = suggestionText(suggestion);
            return (
              <li
                key={index}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{text.title}</p>
                  <p className="text-fg-muted text-sm">{text.detail}</p>
                </div>
                {suggestion.kind === 'mock' ? (
                  <QuickStart
                    countryCode={countryCode}
                    label="Start"
                    examFormatId={suggestion.examFormatId}
                  />
                ) : (
                  <QuickStart
                    countryCode={countryCode}
                    label={suggestion.kind === 'topic' ? 'Practise' : 'Start'}
                    focus={suggestion.kind === 'topic' ? `topic:${suggestion.topicId}` : 'adaptive'}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      <details className="mt-6">
        <summary className="text-primary-fg cursor-pointer text-sm font-medium">By topic</summary>
        <ul className="mt-3 space-y-3">
          {readiness.topics.map((topic) => (
            <li key={topic.topicId}>
              <div className="flex justify-between gap-3 text-sm">
                <span>
                  {topic.name} <span className="text-fg-subtle">({topic.share}% of the exam)</span>
                </span>
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
      </details>
    </div>
  );
}
