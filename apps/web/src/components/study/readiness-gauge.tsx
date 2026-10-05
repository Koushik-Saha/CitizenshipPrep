import type { ReadinessView } from '@oathly/api';
import type { Translator } from '@oathly/i18n';

import { useT } from '@/components/i18n/provider';
import { Badge } from '@/components/ui';

import { QuickStart } from './start-forms';

// A semicircle gauge that sweeps up to the score when the page loads, and
// the few things most worth studying next. The sweep is a CSS animation
// (globals.css), switched off for reduced motion.

const ARC = 'M 16 104 A 88 88 0 0 1 192 104';

function Gauge({ score, early }: { score: number; early: boolean }) {
  const t = useT();
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-valuetext={t(early ? 'readiness.meterEarly' : 'readiness.meter', { score })}
      aria-label={t('readiness.title')}
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
        {/* Nothing to draw at 0: a round cap would still show a dot. */}
        {score > 0 && (
          <path
            d={ARC}
            pathLength={100}
            fill="none"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray="100 100"
            strokeDashoffset={100 - score}
            className="gauge-fill stroke-accent"
          />
        )}
      </svg>
      <p className="absolute inset-x-0 bottom-0 text-center">
        <span className="font-display text-5xl font-semibold tabular-nums">{score}</span>
        <span className="text-fg-muted text-xl">%</span>
      </p>
    </div>
  );
}

function suggestionText(
  suggestion: ReadinessView['suggestions'][number],
  t: Translator,
): {
  title: string;
  detail: string;
} {
  switch (suggestion.kind) {
    case 'start':
      return {
        title: t('readiness.suggestStart'),
        detail: t('readiness.suggestStartDetail'),
      };
    case 'review':
      return {
        title: t('readiness.suggestReview', { count: suggestion.count }),
        detail: t('readiness.suggestReviewDetail'),
      };
    case 'topic':
      return {
        title: suggestion.name,
        detail: t('readiness.suggestTopicDetail', {
          share: suggestion.share,
          mastery: suggestion.mastery,
        }),
      };
    case 'mock':
      return {
        title: t('readiness.suggestMock'),
        detail: t('readiness.suggestMockDetail', { exam: suggestion.examName }),
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
  const t = useT();
  return (
    <div className="bg-surface border-border rounded-lg border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{t('readiness.title')}</h3>
        {readiness.isEarlyEstimate && <Badge tone="warning">{t('readiness.earlyEstimate')}</Badge>}
      </div>
      <div className="mt-4">
        <Gauge score={readiness.score} early={readiness.isEarlyEstimate} />
      </div>
      <p className="text-fg-muted mt-3 text-sm">
        {readiness.isEarlyEstimate
          ? `${t('readiness.basedOn', { count: readiness.questionsSeen })} `
          : ''}
        {t('readiness.disclaimer')}
      </p>
      <dl className="text-fg-muted mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt>{t('readiness.topicKnowledge')}</dt>
          <dd className="text-fg font-medium">{readiness.knowledge}%</dd>
        </div>
        <div>
          <dt>{t('readiness.recentMocks')}</dt>
          <dd className="text-fg font-medium">
            {readiness.mockAverage === null
              ? t('readiness.noMocks')
              : t('readiness.mockAverage', { percent: readiness.mockAverage })}
          </dd>
        </div>
      </dl>

      <h4 className="mt-6 font-medium">{t('readiness.studyNext')}</h4>
      {readiness.suggestions.length === 0 ? (
        <p className="text-fg-muted mt-2 text-sm">{t('readiness.nothingStandsOut')}</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {readiness.suggestions.map((suggestion, index) => {
            const text = suggestionText(suggestion, t);
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
                    label={t('readiness.start')}
                    examFormatId={suggestion.examFormatId}
                  />
                ) : (
                  <QuickStart
                    countryCode={countryCode}
                    label={
                      suggestion.kind === 'topic' ? t('dashboard.practise') : t('readiness.start')
                    }
                    focus={suggestion.kind === 'topic' ? `topic:${suggestion.topicId}` : 'adaptive'}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      <details className="mt-6">
        <summary className="text-primary-fg cursor-pointer text-sm font-medium">
          {t('readiness.byTopic')}
        </summary>
        <ul className="mt-3 space-y-3">
          {readiness.topics.map((topic) => (
            <li key={topic.topicId}>
              <div className="flex justify-between gap-3 text-sm">
                <span>
                  {topic.name}{' '}
                  <span className="text-fg-subtle">
                    {t('readiness.shareOfExam', { share: topic.share })}
                  </span>
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
