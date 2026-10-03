'use client';

import type { StudySession } from '@oathly/api';
import { scoreAttempt, type MockExam, type QuizQuestion } from '@oathly/core';
import Link from 'next/link';
import { useEffect, useMemo, useRef } from 'react';

import { HERO_VIEW } from '@/components/globe/config';
import { GlobePoster } from '@/components/globe/globe-poster';
import { GlobeSlot } from '@/components/globe/globe-slot';
import type { GlobeMarker } from '@/components/globe/scene-store';
import { buttonClass, focusRing } from '@/components/ui';

import { ExplainMore } from './explain-more';
import type { GivenAnswer } from './study-session';

export function Results({
  session,
  quizQuestions,
  mockExam,
  answers,
  note,
}: {
  session: StudySession;
  quizQuestions: QuizQuestion[];
  mockExam: MockExam | null;
  answers: GivenAnswer[];
  note: string | null;
}) {
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
  const location = session.countryLocation;
  const celebration = useMemo<GlobeMarker[]>(
    () =>
      location
        ? [{ code: session.countryCode, name: session.countryName, ...location, facts: [] }]
        : [],
    [location, session.countryCode, session.countryName],
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      {passed && celebration.length > 0 && (
        // The pass celebration: the globe turns to the country and sends out rings.
        <div
          data-theme="dark"
          className="bg-canvas float-right ml-4 w-32 rounded-full sm:-mt-4 sm:w-44"
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
        {mockExam ? session.exam?.name : isFlashcards ? 'Flashcards' : 'Practice'},{' '}
        {session.countryName}
      </p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display mt-2 text-4xl font-semibold outline-none"
      >
        {score?.exam
          ? score.exam.passed
            ? 'You passed'
            : 'Not a pass this time'
          : 'Session complete'}
      </h1>
      {note && <p className="text-fg-muted mt-2">{note}</p>}

      <p className="mt-6 text-xl">
        <span className="font-display text-4xl font-semibold">{correct}</span>
        <span className="text-fg-muted">
          {' '}
          of {session.questions.length} {isFlashcards ? 'known' : 'correct'}
          {mockExam?.passMark != null ? `. ${mockExam.passMark} needed to pass.` : '.'}
        </span>
      </p>
      {score?.exam && score.exam.reasons.length > 0 && (
        <ul className="text-error-fg mt-3 list-disc pl-5">
          {score.exam.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {score?.exam?.timedOut && (
        <p className="text-fg-muted mt-2">Time ran out before the last answers.</p>
      )}

      {score && (
        <section aria-labelledby="by-topic" className="mt-10">
          <h2 id="by-topic" className="font-display text-2xl font-medium">
            By topic
          </h2>
          <table className="mt-3 w-full text-left">
            <thead className="text-fg-muted text-sm">
              <tr>
                <th scope="col" className="py-2 font-medium">
                  Topic
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Correct
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {Object.entries(score.byTopic).map(([topicId, topic]) => (
                <tr key={topicId}>
                  <td className="py-2">{topicNames.get(topicId)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {topic.correct} of {topic.total}
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
            ? 'Nothing to review'
            : isFlashcards
              ? 'Cards to go over again'
              : 'Review your wrong answers'}
        </h2>
        <ol className="mt-4 space-y-4">
          {wrong.map((answer) => {
            const question = byId.get(answer.questionId)!;
            const given = question.options.filter((option) =>
              answer.selectedKeys.includes(option.key),
            );
            const right = question.options.filter((option) =>
              question.correctKeys.includes(option.key),
            );
            return (
              <li
                key={answer.questionId}
                className="bg-surface border-border rounded-lg border p-5"
                lang={question.locale}
              >
                <p className="font-medium">{question.text}</p>
                {!isFlashcards && (
                  <p className="text-error-fg mt-2">
                    <span className="sr-only">Your answer: </span>
                    <span aria-hidden="true">You answered: </span>
                    {given.map((option) => option.text).join('; ') || 'nothing'}
                  </p>
                )}
                <p className="text-success-fg mt-1">
                  Correct answer: {right.map((option) => option.text).join('; ')}
                </p>
                {question.explanation && (
                  <p className="text-fg-muted mt-2">{question.explanation}</p>
                )}
                {!isFlashcards && <ExplainMore questionId={question.id} />}
                {question.sourceQuote && (
                  <p className="text-fg-muted mt-2 text-sm">
                    From the official guide: “{question.sourceQuote}”{' '}
                    <a
                      href={question.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${focusRing} rounded-xs underline`}
                    >
                      source
                    </a>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <Link href="/study" className={`${buttonClass.primary} mt-10`}>
        Back to study
      </Link>
    </main>
  );
}
