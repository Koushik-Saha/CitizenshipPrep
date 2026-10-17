'use client';

import type { GuideQuestion } from '@oathly/api/countries';
import {
  FREE_QUESTIONS_PER_COUNTRY,
  flipCard,
  isSelfMarked,
  nextQuestion,
  startRun,
  submitAnswer,
  toggleOption,
  type QuizQuestion,
  type RunConfig,
  type RunState,
} from '@oathly/core';
import { textDirection } from '@oathly/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useT } from '@/components/i18n/provider';
import Link from '@/components/link';
import { buttonClass, focusRing, textButtonClass } from '@/components/ui';

// A round of real practice for a visitor without an account: the country's
// first public sample questions, each checked with the answer and why. It
// runs on the same rules as practice in the app (packages/core session-run)
// and keeps nothing: there is no one to keep it for.

export type TrialQuestion = Pick<
  GuideQuestion,
  'id' | 'type' | 'topic' | 'locale' | 'text' | 'options' | 'correctKeys' | 'explanation'
>;

const toQuiz = (question: TrialQuestion): QuizQuestion => ({
  id: question.id,
  topicId: question.topic.slug,
  topicSlug: question.topic.slug,
  difficulty: 1,
  type: question.type,
  correctKeys: question.correctKeys,
  regionCode: null,
  version: 1,
});

export function GuestTrial({
  questions,
  signUpHref,
  backHref,
  backLabel,
}: {
  questions: TrialQuestion[];
  signUpHref: string;
  backHref: string;
  backLabel: string;
}) {
  const t = useT();
  const config = useMemo<RunConfig>(
    () => ({ mode: 'practice', questions: questions.map(toQuiz), exam: null }),
    [questions],
  );
  const [run, setRun] = useState<RunState>(() => startRun());
  const shownAt = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);
  const done = run.phase === 'results';

  // A new question (or the results): its clock starts, and focus moves to it
  // for screen readers, though not on first arrival.
  useEffect(() => {
    shownAt.current = Date.now();
    if (started.current) headingRef.current?.focus();
    started.current = true;
  }, [run.index, done]);

  const submit = (knewIt?: boolean) =>
    setRun(
      (current) =>
        submitAnswer(config, current, { now: new Date(), shownAt: shownAt.current, knewIt }).state,
    );

  if (done) {
    const correct = run.answers.filter((answer) => answer.correct).length;
    return (
      <section aria-labelledby="trial-done" className="mt-8" data-testid="trial-results">
        <h2
          id="trial-done"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-3xl font-semibold outline-none"
        >
          {t('trial.doneTitle', { correct, total: questions.length })}
        </h2>
        <p className="text-fg-muted mt-3 text-lg">
          {t('trial.doneBody', { free: FREE_QUESTIONS_PER_COUNTRY })}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href={signUpHref} className={buttonClass.primary}>
            {t('trial.signUp')}
          </Link>
          <button
            type="button"
            onClick={() => setRun(startRun())}
            className={buttonClass.secondary}
          >
            {t('common.tryAgain')}
          </button>
        </div>
        <p className="mt-6">
          <Link href={backHref} className={textButtonClass}>
            {backLabel}
          </Link>
        </p>
      </section>
    );
  }

  const question = questions[run.index]!;
  const quiz = config.questions[run.index]!;
  const own = { lang: question.locale, dir: textDirection(question.locale) };
  const given = run.phase === 'feedback' ? run.answers[run.answers.length - 1]! : null;
  const open = isSelfMarked(config.mode, quiz);
  const accepted = question.options.filter((option) => question.correctKeys.includes(option.key));
  const last = run.index + 1 === questions.length;

  return (
    <section aria-label={t('session.practice')} className="mt-8">
      <p className="text-fg-muted text-sm">
        {t('session.questionOf', { current: run.index + 1, total: questions.length })}
      </p>
      <div
        className="bg-surface-sunken mt-2 h-1 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={t('session.progress')}
        aria-valuenow={run.index + 1}
        aria-valuemin={1}
        aria-valuemax={questions.length}
      >
        <div
          className="bg-primary h-full"
          style={{ width: `${((run.index + 1) / questions.length) * 100}%` }}
        />
      </div>
      <p className="text-fg-muted mt-6 text-sm">{question.topic.name}</p>
      <h2
        ref={headingRef}
        tabIndex={-1}
        {...own}
        className="font-display mt-2 text-2xl font-medium outline-none sm:text-3xl"
      >
        {question.text}
      </h2>

      {open ? (
        // Answered in one's own words, as on the day; then checked against the accepted answers.
        <div className="mt-6">
          {run.flipped ? (
            <div role="status" className="bg-surface border-border rounded-lg border p-5">
              <p className="text-fg-muted text-sm">
                {accepted.length > 1 ? t('session.acceptedAnswers') : t('session.answer')}
              </p>
              <ul {...own} className="mt-1 list-disc space-y-1 ps-5 text-lg font-medium">
                {accepted.map((option) => (
                  <li key={option.key}>{option.text}</li>
                ))}
              </ul>
              {question.explanation && (
                <p {...own} className="text-fg-muted mt-3">
                  {question.explanation}
                </p>
              )}
            </div>
          ) : (
            <p className="text-fg-muted">{t('session.sayAnswer')}</p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {run.flipped ? (
              <>
                <button
                  type="button"
                  onClick={() => submit(false)}
                  className={buttonClass.secondary}
                >
                  {t('session.didNotKnow')}
                </button>
                <button type="button" onClick={() => submit(true)} className={buttonClass.primary}>
                  {t('session.knewIt')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setRun((current) => flipCard(config, current))}
                className={buttonClass.primary}
              >
                {t('session.showAnswer')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <fieldset className="mt-6">
            <legend className="sr-only">{t('session.chooseOne')}</legend>
            <ul className="space-y-2">
              {question.options.map((option, i) => {
                const chosen = (given?.selectedKeys ?? run.selected).includes(option.key);
                const right = given !== null && question.correctKeys.includes(option.key);
                const wrong = given !== null && chosen && !right;
                return (
                  <li key={option.key}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      disabled={given !== null}
                      onClick={() => setRun((current) => toggleOption(config, current, option.key))}
                      className={`${focusRing} flex min-h-11 w-full items-start gap-4 rounded-md border px-4 py-3 text-start ${
                        right
                          ? 'border-success bg-success-soft'
                          : wrong
                            ? 'border-error bg-error-soft'
                            : chosen
                              ? 'border-primary bg-primary-soft'
                              : 'border-border-strong bg-surface hover:bg-surface-sunken'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="text-fg-muted border-border mt-0.5 rounded-xs border px-1.5 font-mono text-xs"
                      >
                        {i + 1}
                      </span>
                      <span {...own} className="flex-1">
                        {option.text}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
          <div role="status" className="mt-6 min-h-6">
            {given && (
              <div
                className={`rounded-md px-4 py-3 ${given.correct ? 'bg-success-soft text-success-fg' : 'bg-error-soft text-error-fg'}`}
              >
                <p className="font-semibold">
                  {given.correct ? t('session.correct') : t('session.notQuite')}
                </p>
                {question.explanation && (
                  <p {...own} className="text-fg mt-1">
                    {question.explanation}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="mt-4">
            {given ? (
              <button
                type="button"
                onClick={() => setRun((current) => nextQuestion(config, current))}
                className={buttonClass.primary}
              >
                {last ? t('session.seeResults') : t('session.nextQuestion')}
              </button>
            ) : (
              <button
                type="button"
                disabled={run.selected.length === 0}
                onClick={() => submit()}
                className={buttonClass.primary}
              >
                {t('session.check')}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
