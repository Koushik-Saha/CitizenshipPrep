'use client';

import type { StudySession } from '@oathly/api';
import { questionWording } from '@oathly/api/study';
import { scoreAttempt, type MockExam, type QuizQuestion } from '@oathly/core';
import { countryName, isolate, textDirection, type MessageKey } from '@oathly/i18n';
import { useEffect, useMemo, useRef } from 'react';

import { HERO_VIEW } from '@/components/globe/config';
import { GlobePoster } from '@/components/globe/globe-poster';
import { GlobeSlot } from '@/components/globe/globe-slot';
import type { GlobeMarker } from '@/components/globe/scene-store';
import { useT } from '@/components/i18n/provider';
import Link from '@/components/link';
import { buttonClass, focusRing } from '@/components/ui';

import { ExplainMore } from './explain-more';
import type { GivenAnswer } from './study-session';

export function Results({
  session,
  quizQuestions,
  mockExam,
  answers,
  note,
  inExamLanguage,
}: {
  session: StudySession;
  quizQuestions: QuizQuestion[];
  mockExam: MockExam | null;
  answers: GivenAnswer[];
  /** Why the session stopped early, if it did. */
  note: MessageKey | null;
  /** Whether the learner was reading the questions as the exam words them. */
  inExamLanguage: boolean;
}) {
  const t = useT();
  const country = countryName(session.countryCode, t.locale, session.countryName);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  const isFlashcards = session.mode === 'flashcards';
  const byId = new Map(session.questions.map((question) => [question.id, question]));
  // Flashcards are self-rated, so score them by the learner's own verdict.
  const score = isFlashcards
    ? null
    : scoreAttempt(
        quizQuestions,
        answers,
        mockExam ? { exam: mockExam, startedAt: new Date(session.startedAt) } : {},
      );
  const correct = isFlashcards ? answers.filter((answer) => answer.correct).length : score!.correct;
  const wrong = answers.filter((answer) => !answer.correct);
  const topicNames = new Map(
    session.questions.map((question) => [question.topicId, question.topicName]),
  );
  const passed = score?.exam?.passed ?? false;
  const failedSections = score?.exam?.sections.filter((section) => !section.passed) ?? [];
  const location = session.countryLocation;
  const celebration = useMemo<GlobeMarker[]>(
    () => (location ? [{ code: session.countryCode, name: country, ...location, facts: [] }] : []),
    [country, location, session.countryCode],
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      {passed && celebration.length > 0 && (
        // The pass celebration: the globe turns to the country and sends out rings.
        <div
          data-theme="dark"
          className="bg-canvas float-end ms-4 w-32 rounded-full sm:-mt-4 sm:w-44"
        >
          <GlobeSlot
            scene="celebration"
            view={HERO_VIEW}
            markers={celebration}
            focus={session.countryCode}
          >
            <GlobePoster
              view={HERO_VIEW}
              markers={celebration}
              focus={session.countryCode}
              sizes="11rem"
            />
          </GlobeSlot>
        </div>
      )}
      <p className="text-fg-muted text-sm">
        {mockExam
          ? session.exam?.name
          : isFlashcards
            ? t('session.flashcards')
            : t('session.practice')}
        {t('exam.factSeparator')}
        {country}
      </p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display mt-2 text-4xl font-semibold outline-none"
      >
        {score?.exam
          ? score.exam.passed
            ? t('results.passed')
            : t('results.notPassed')
          : t('results.complete')}
      </h1>
      {note && <p className="text-fg-muted mt-2">{t(note)}</p>}

      <p className="mt-6 text-xl">
        <span className="font-display text-4xl font-semibold">{correct}</span>
        <span className="text-fg-muted">
          {' '}
          {t(isFlashcards ? 'results.knownOf' : 'results.correctOf', {
            total: session.questions.length,
          })}
          {mockExam?.passMark != null
            ? ` ${t('results.neededToPass', { count: mockExam.passMark })}`
            : ''}
        </span>
      </p>
      {/* Missing the pass mark is said above; a section that had to be perfect is said here. */}
      {failedSections.length > 0 && (
        <ul className="text-error-fg mt-3 list-disc ps-5">
          {failedSections.map((section) => (
            <li key={section.id}>
              {t('results.sectionAllCorrect', {
                section: isolate(section.label),
                correct: section.correct,
                total: section.total,
              })}
            </li>
          ))}
        </ul>
      )}
      {score?.exam?.timedOut && <p className="text-fg-muted mt-2">{t('results.timedOut')}</p>}

      {score && (
        <section aria-labelledby="by-topic" className="mt-10">
          <h2 id="by-topic" className="font-display text-2xl font-medium">
            {t('results.byTopic')}
          </h2>
          <table className="mt-3 w-full text-start">
            <thead className="text-fg-muted text-sm">
              <tr>
                <th scope="col" className="py-2 font-medium">
                  {t('results.topic')}
                </th>
                <th scope="col" className="py-2 text-end font-medium">
                  {t('results.correctColumn')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {Object.entries(score.byTopic).map(([topicId, topic]) => (
                <tr key={topicId}>
                  <td className="py-2">{topicNames.get(topicId)}</td>
                  <td className="py-2 text-end tabular-nums">
                    {t('results.scoreOf', { correct: topic.correct, total: topic.total })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="review" className="mt-10">
        <h2 id="review" className="font-display text-2xl font-medium">
          {wrong.length === 0
            ? t('results.nothingToReview')
            : isFlashcards
              ? t('results.reviewCards')
              : t('results.reviewWrong')}
        </h2>
        <ol className="mt-4 space-y-4">
          {wrong.map((answer) => {
            const question = byId.get(answer.questionId)!;
            const wording = questionWording(question, inExamLanguage);
            const wordingProps = { lang: wording.locale, dir: textDirection(wording.locale) };
            const given = wording.options.filter((option) =>
              answer.selectedKeys.includes(option.key),
            );
            const right = wording.options.filter((option) =>
              question.correctKeys.includes(option.key),
            );
            return (
              <li
                key={answer.questionId}
                className="bg-surface border-border rounded-lg border p-5"
              >
                <p className="font-medium" {...wordingProps}>
                  {wording.text}
                </p>
                {!isFlashcards && (
                  <p className="text-error-fg mt-2">
                    {t('results.youAnswered', {
                      answer:
                        given.length > 0
                          ? isolate(given.map((option) => option.text).join('; '))
                          : t('results.nothing'),
                    })}
                  </p>
                )}
                <p className="text-success-fg mt-1">
                  {t('results.correctAnswer', {
                    answer: isolate(right.map((option) => option.text).join('; ')),
                  })}
                </p>
                {wording.explanation && (
                  <p className="text-fg-muted mt-2" {...wordingProps}>
                    {wording.explanation}
                  </p>
                )}
                {!isFlashcards && <ExplainMore questionId={question.id} />}
                {question.sourceQuote && (
                  <p className="text-fg-muted mt-2 text-sm">
                    {t('session.fromGuide', { quote: isolate(question.sourceQuote) })}{' '}
                    <a
                      href={question.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${focusRing} rounded-xs underline`}
                    >
                      {t('results.source')}
                    </a>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <Link href="/study" prefetch className={`${buttonClass.primary} mt-10`}>
        {t('common.backToStudy')}
      </Link>
    </main>
  );
}
