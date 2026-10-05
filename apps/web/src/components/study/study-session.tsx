'use client';

import {
  questionWording,
  toMockExam,
  toQuizQuestion,
  type QuestionWording,
  type SessionQuestion,
  type StudySession as Session,
} from '@oathly/api/study';
import { examDecision, isCorrect, type Answer } from '@oathly/core';
import { queryKeys } from '@oathly/api/queries';
import { countryName, languageName, textDirection, type MessageKey } from '@oathly/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useT } from '@/components/i18n/provider';
import Link from '@/components/link';
import { buttonClass, focusRing } from '@/components/ui';
import { completeSession, flushAnswers, recordAnswer } from '@/lib/answer-sync';

import { ExplainMore } from './explain-more';
import { Results } from './results';
import { useCountdown } from './use-countdown';

// Runs a whole study session in the browser. Everything it needs arrived with
// the page; answering never waits for the network. Answers go to a background
// queue (lib/answer-sync) and are saved with retries.

export interface GivenAnswer extends Answer {
  correct: boolean;
}

type Phase = 'answering' | 'feedback' | 'results';

const keyLabel = (index: number) => String(index + 1);

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export function StudySession({ session }: { session: Session }) {
  const { questions } = session;
  const isExam = session.mode === 'mock_exam';
  const isFlashcards = session.mode === 'flashcards';
  const quizQuestions = useMemo(() => questions.map(toQuizQuestion), [questions]);
  const mockExam = useMemo(() => toMockExam(session), [session]);
  const queryClient = useQueryClient();
  const t = useT();

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>(session.completedAt ? 'results' : 'answering');
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<GivenAnswer[]>([]);
  const [stopNote, setStopNote] = useState<MessageKey | null>(null);
  // Study language or the exam's own, for questions that have both. The
  // choice carries on to the next question until it is changed back.
  const [inExamLanguage, setInExamLanguage] = useState(false);
  const shownAt = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const question = questions[index]!;
  const wording = questionWording(question, inExamLanguage);
  const wordingProps = { lang: wording.locale, dir: textDirection(wording.locale) };
  const deadline =
    session.exam?.timeLimitMs != null
      ? Date.parse(session.startedAt) + session.exam.timeLimitMs
      : null;

  const finish = useCallback((given: GivenAnswer[], note: MessageKey | null = null) => {
    setStopNote(note);
    setPhase('results');
    flushAnswers();
  }, []);

  const remaining = useCountdown(deadline, phase !== 'results', () =>
    finish(answers, 'results.timeUp'),
  );

  // A new question: start its clock and move focus to it for screen readers.
  useEffect(() => {
    shownAt.current = Date.now();
    if (phase === 'answering') headingRef.current?.focus();
  }, [index, phase]);

  const advance = useCallback(
    (given: GivenAnswer[]) => {
      setSelected([]);
      setFlipped(false);
      if (index + 1 >= questions.length) {
        finish(given);
        return;
      }
      setIndex(index + 1);
      setPhase('answering');
    },
    [finish, index, questions.length],
  );

  const submit = useCallback(
    (selectedKeys: string[], correctOverride?: boolean) => {
      const now = new Date();
      const correct = correctOverride ?? isCorrect(quizQuestions[index]!, selectedKeys);
      const answer: GivenAnswer = {
        questionId: question.id,
        selectedKeys,
        timeMs: Math.min(now.getTime() - shownAt.current, 10 * 60_000),
        answeredAt: now,
        correct,
      };
      // Fire and forget: queued locally, sent in the background.
      recordAnswer({
        clientEventId: crypto.randomUUID(),
        attemptId: session.attemptId,
        questionId: question.id,
        questionVersion: question.version,
        selectedKeys,
        correct,
        timeMs: answer.timeMs,
        answeredAt: now.toISOString(),
      });
      const given = [...answers, answer];
      setAnswers(given);

      if (isExam && mockExam) {
        if (mockExam.stopEarly) {
          const decision = examDecision(mockExam, quizQuestions, given);
          if (decision) {
            finish(
              given,
              decision === 'passed' ? 'results.stoppedPassed' : 'results.stoppedFailed',
            );
            return;
          }
        }
        // Real exams do not say whether an answer was right.
        advance(given);
        return;
      }
      if (isFlashcards) {
        advance(given);
        return;
      }
      setPhase('feedback');
    },
    [
      advance,
      answers,
      finish,
      index,
      isExam,
      isFlashcards,
      mockExam,
      question,
      quizQuestions,
      session.attemptId,
    ],
  );

  const toggle = useCallback(
    (key: string) => {
      if (phase !== 'answering') return;
      setSelected((current) =>
        question.type === 'multi_select'
          ? current.includes(key)
            ? current.filter((value) => value !== key)
            : [...current, key]
          : [key],
      );
    },
    [phase, question.type],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (phase === 'results') return;
      const onButton = event.target instanceof HTMLButtonElement;

      if (isFlashcards) {
        if (!flipped && (event.key === 'Enter' || event.key === ' ') && !onButton) {
          event.preventDefault();
          setFlipped(true);
        } else if (flipped && (event.key === '1' || event.key === '2')) {
          event.preventDefault();
          submit([], event.key === '2');
        }
        return;
      }

      const digit = Number(event.key);
      if (
        phase === 'answering' &&
        Number.isInteger(digit) &&
        digit >= 1 &&
        digit <= question.options.length
      ) {
        event.preventDefault();
        toggle(question.options[digit - 1]!.key);
      } else if (event.key === 'Enter' && !onButton) {
        event.preventDefault();
        if (phase === 'answering' && selected.length > 0) submit(selected);
        else if (phase === 'feedback') advance(answers);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, answers, flipped, isFlashcards, phase, question.options, selected, submit, toggle]);

  useEffect(() => {
    if (phase !== 'results' || session.completedAt) return;
    const correct = answers.filter((answer) => answer.correct).length;
    let passed: boolean | null = null;
    if (isExam && mockExam) {
      const strict = new Set(
        mockExam.sections.filter((s) => s.mustAllBeCorrect).flatMap((s) => s.questionIds),
      );
      const right = new Set(
        answers.filter((answer) => answer.correct).map((answer) => answer.questionId),
      );
      passed =
        (mockExam.passMark === null || correct >= mockExam.passMark) &&
        [...strict].every((id) => right.has(id));
    }
    completeSession(session.attemptId, { correct, total: questions.length, passed });
    // The cached dashboard is now out of date: it refetches when next shown.
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  }, [
    answers,
    isExam,
    mockExam,
    phase,
    queryClient,
    questions.length,
    session.attemptId,
    session.completedAt,
  ]);

  if (session.completedAt && answers.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="font-display text-3xl font-semibold">{t('session.finishedTitle')}</h1>
        <p className="text-fg-muted mt-3">{t('session.finishedBody')}</p>
        <Link href="/study" prefetch className={`${buttonClass.primary} mt-6`}>
          {t('common.backToStudy')}
        </Link>
      </main>
    );
  }

  if (phase === 'results') {
    return (
      <Results
        session={session}
        quizQuestions={quizQuestions}
        mockExam={mockExam}
        answers={answers}
        note={stopNote}
        inExamLanguage={inExamLanguage}
      />
    );
  }

  const lastAnswer = answers[answers.length - 1];
  const title = isExam
    ? session.exam?.name
    : isFlashcards
      ? t('session.flashcards')
      : t('session.practice');

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <header className="text-fg-muted flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>
          {title}
          {t('exam.factSeparator')}
          {countryName(session.countryCode, t.locale, session.countryName)}
        </span>
        <span className="flex items-center gap-4">
          {remaining !== null && (
            <span
              className="font-medium tabular-nums"
              aria-label={t('session.timeLeftMinutes', { count: Math.ceil(remaining / 60_000) })}
              // A clock reads the same way round in every language.
              dir="ltr"
            >
              {String(Math.floor(remaining / 60_000)).padStart(2, '0')}:
              {String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0')}
            </span>
          )}
          <span>{t('session.questionOf', { current: index + 1, total: questions.length })}</span>
        </span>
      </header>
      <div
        className="bg-surface-sunken mt-3 h-1 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={t('session.progress')}
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={questions.length}
      >
        <div
          className="bg-primary h-full"
          style={{ width: `${((index + 1) / questions.length) * 100}%` }}
        />
      </div>

      <p className="text-fg-muted mt-8 text-sm">{question.topicName}</p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        {...wordingProps}
        className="font-display mt-2 text-2xl font-medium outline-none sm:text-3xl"
      >
        {wording.text}
      </h1>
      {question.original && (
        // The real exam is in its own language: one press shows this question
        // as the exam words it, and another brings the study language back.
        <p className="mt-3 text-sm">
          <button
            type="button"
            onClick={() => setInExamLanguage((current) => !current)}
            className={`${focusRing} text-primary-fg rounded-xs font-medium underline underline-offset-4`}
          >
            {inExamLanguage
              ? t('session.showInStudyLanguage', {
                  language: languageName(question.locale, t.locale),
                })
              : t('session.showInExamLanguage', {
                  language: languageName(question.original.locale, t.locale),
                })}
          </button>
        </p>
      )}

      {isFlashcards ? (
        <Flashcard
          question={question}
          wording={wording}
          flipped={flipped}
          onFlip={() => setFlipped(true)}
          onRate={(knew) => submit([], knew)}
        />
      ) : (
        <>
          <fieldset className="mt-6">
            <legend className="sr-only">
              {question.type === 'multi_select' ? t('session.chooseAll') : t('session.chooseOne')}
            </legend>
            <ul className="space-y-2">
              {wording.options.map((option, optionIndex) => {
                const chosen =
                  selected.includes(option.key) ||
                  (phase === 'feedback' && lastAnswer?.selectedKeys.includes(option.key));
                const right = phase === 'feedback' && question.correctKeys.includes(option.key);
                const wrong = phase === 'feedback' && chosen && !right;
                return (
                  <li key={option.key}>
                    <button
                      type="button"
                      role={question.type === 'multi_select' ? 'checkbox' : 'radio'}
                      aria-checked={Boolean(chosen)}
                      disabled={phase !== 'answering'}
                      onClick={() => toggle(option.key)}
                      className={`${focusRing} flex w-full items-start gap-4 rounded-md border px-4 py-3 text-start ${
                        right
                          ? 'border-success bg-success-soft'
                          : wrong
                            ? 'border-error bg-error-soft'
                            : chosen
                              ? 'border-primary bg-primary-soft'
                              : 'border-border-strong bg-surface hover:bg-surface-sunken'
                      }`}
                    >
                      <kbd className="text-fg-muted border-border mt-0.5 rounded-xs border px-1.5 font-mono text-xs">
                        {keyLabel(optionIndex)}
                      </kbd>
                      <span {...wordingProps} className="flex-1">
                        {option.text}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <div role="status" className="mt-6 min-h-6">
            {phase === 'feedback' && lastAnswer && (
              <div
                className={`rounded-md px-4 py-3 ${lastAnswer.correct ? 'bg-success-soft text-success-fg' : 'bg-error-soft text-error-fg'}`}
              >
                <p className="font-semibold">
                  {lastAnswer.correct ? t('session.correct') : t('session.notQuite')}
                </p>
                {wording.explanation && (
                  <p className="text-fg mt-1" {...wordingProps}>
                    {wording.explanation}
                  </p>
                )}
                {!lastAnswer.correct && <ExplainMore key={question.id} questionId={question.id} />}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-4">
            {phase === 'answering' ? (
              <button
                type="button"
                disabled={selected.length === 0}
                onClick={() => submit(selected)}
                className={buttonClass.primary}
              >
                {isExam
                  ? index + 1 === questions.length
                    ? t('session.submitExam')
                    : t('session.next')
                  : t('session.check')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => advance(answers)}
                className={buttonClass.primary}
              >
                {index + 1 === questions.length
                  ? t('session.seeResults')
                  : t('session.nextQuestion')}
              </button>
            )}
            <p className="text-fg-subtle hidden text-sm sm:block">
              {phase === 'answering'
                ? t('session.keysChoose', { count: question.options.length })
                : t('session.keysContinue')}
            </p>
          </div>
        </>
      )}
    </main>
  );
}

function Flashcard({
  question,
  wording,
  flipped,
  onFlip,
  onRate,
}: {
  question: SessionQuestion;
  /** The question's words in the language being shown. */
  wording: QuestionWording;
  flipped: boolean;
  onFlip: () => void;
  onRate: (knew: boolean) => void;
}) {
  const t = useT();
  const answers = wording.options.filter((option) => question.correctKeys.includes(option.key));
  const wordingProps = { lang: wording.locale, dir: textDirection(wording.locale) };
  return (
    <div className="mt-6">
      {flipped ? (
        <div role="status" className="bg-surface border-border rounded-lg border p-5">
          <p className="text-fg-muted text-sm">{t('session.answer')}</p>
          <p className="mt-1 text-xl font-medium" {...wordingProps}>
            {answers.map((option) => option.text).join('; ')}
          </p>
          {wording.explanation && (
            <p className="text-fg-muted mt-3" {...wordingProps}>
              {wording.explanation}
            </p>
          )}
        </div>
      ) : (
        <p className="text-fg-muted">{t('session.answerInHead')}</p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {flipped ? (
          <>
            <button type="button" onClick={() => onRate(false)} className={buttonClass.secondary}>
              <kbd className="me-2 font-mono text-xs">1</kbd> {t('session.didNotKnow')}
            </button>
            <button type="button" onClick={() => onRate(true)} className={buttonClass.primary}>
              <kbd className="me-2 font-mono text-xs">2</kbd> {t('session.knewIt')}
            </button>
          </>
        ) : (
          <button type="button" onClick={onFlip} className={buttonClass.primary}>
            {t('session.showAnswer')}
          </button>
        )}
        <p className="text-fg-subtle hidden text-sm sm:block">
          {flipped ? t('session.keysRate') : t('session.keysTurn')}
        </p>
      </div>
    </div>
  );
}
