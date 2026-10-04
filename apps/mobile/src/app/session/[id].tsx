import { toMockExam, toQuizQuestion, type StudySession } from '@oathly/api';
import { useStudySession } from '@oathly/api/hooks';
import { queryKeys } from '@oathly/api/queries';
import {
  flipCard,
  nextQuestion,
  runDeadline,
  runResult,
  startRun,
  submitAnswer,
  timeUp,
  toggleOption,
  type RunConfig,
  type RunState,
} from '@oathly/core';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Flashcard } from '@/components/flashcard';
import { OptionButton, type OptionState } from '@/components/option-button';
import { ProgressBar } from '@/components/progress-bar';
import { Results } from '@/components/results';
import { Body, Button, Card, Heading, LinkButton, Screen, useTheme } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { backToStudy } from '@/lib/navigation';
import { completeSession, recordAnswer } from '@/lib/offline';

/** Time left on the exam clock, ticking once a second; null when there is no clock. */
function useCountdown(deadline: number | null, active: boolean, onExpire: () => void) {
  const [remaining, setRemaining] = useState(() =>
    deadline === null ? null : Math.max(0, deadline - Date.now()),
  );
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });
  useEffect(() => {
    if (deadline === null || !active) return;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left === 0) expire.current();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [active, deadline]);
  return remaining;
}

function clock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const modeLabel = { practice: 'Practice', flashcards: 'Flashcards', mock_exam: 'Mock exam' };

function Runner({ session }: { session: StudySession }) {
  const theme = useTheme();
  const client = useQueryClient();
  const config = useMemo<RunConfig>(
    () => ({
      mode: session.mode,
      questions: session.questions.map(toQuizQuestion),
      exam: toMockExam(session),
    }),
    [session],
  );
  const startedAt = useMemo(() => new Date(session.startedAt), [session.startedAt]);
  const [run, setRun] = useState<RunState>(() =>
    startRun({ completed: session.completedAt !== null }),
  );
  const shownAt = useRef(0);
  const reported = useRef(session.completedAt !== null);

  const question = session.questions[run.index]!;
  const isExam = session.mode === 'mock_exam';
  const isFlashcards = session.mode === 'flashcards';

  // A new question: start its clock.
  useEffect(() => {
    shownAt.current = Date.now();
  }, [run.index]);

  const remaining = useCountdown(runDeadline(config, startedAt), run.phase !== 'results', () =>
    setRun((current) => timeUp(current)),
  );

  // The session is over: record the result once. It reaches the server now,
  // or from the outbox when the phone is next online.
  useEffect(() => {
    if (run.phase !== 'results' || reported.current) return;
    reported.current = true;
    const result = runResult(config, run, startedAt);
    completeSession(session.attemptId, result);
    if (result.passed) haptics.celebrate();
    void client.invalidateQueries({ queryKey: queryKeys.dashboard });
  }, [client, config, run, session.attemptId, startedAt]);

  function submit(knewIt?: boolean) {
    const { state, answer } = submitAnswer(config, run, {
      now: new Date(),
      shownAt: shownAt.current,
      knewIt,
    });
    if (!answer) return;
    recordAnswer(
      {
        clientEventId: Crypto.randomUUID(),
        attemptId: session.attemptId,
        questionId: question.id,
        questionVersion: question.version,
        selectedKeys: [...answer.selectedKeys],
        correct: answer.correct,
        timeMs: answer.timeMs,
        answeredAt: answer.answeredAt.toISOString(),
      },
      session.countryCode,
    );
    // A real exam does not say whether you were right, so neither does the phone.
    if (isExam) haptics.recorded();
    else if (answer.correct) haptics.correct();
    else haptics.wrong();
    setRun(state);
  }

  if (run.phase === 'results') {
    return <Results session={session} config={config} run={run} startedAt={startedAt} />;
  }

  const answered = run.answers.length;
  const last = run.index + 1 === session.questions.length;
  const given = run.phase === 'feedback' ? run.answers[run.answers.length - 1]! : null;

  function optionState(key: string): OptionState {
    const chosen = (given?.selectedKeys ?? run.selected).includes(key);
    if (!given) return chosen ? 'selected' : 'idle';
    const right = question.correctKeys.includes(key);
    if (right) return chosen ? 'correct' : 'missed';
    return chosen ? 'wrong' : 'idle';
  }

  return (
    <Screen>
      <View style={{ gap: theme.spacing[3] }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <LinkButton label="Leave" onPress={backToStudy} testID="leave-session" />
          <Text style={[theme.text.sm, { color: theme.colors.fgMuted }]}>
            {isExam ? (session.exam?.name ?? modeLabel.mock_exam) : modeLabel[session.mode]}
          </Text>
          {remaining !== null ? (
            <Text
              accessibilityLabel={`${clock(remaining)} left`}
              accessibilityRole="timer"
              style={[
                theme.text.base,
                {
                  color: remaining < 60_000 ? theme.colors.errorFg : theme.colors.fg,
                  fontWeight: '600',
                  fontVariant: ['tabular-nums'],
                },
              ]}
            >
              {clock(remaining)}
            </Text>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
        <ProgressBar
          value={answered / session.questions.length}
          label={`Question ${run.index + 1} of ${session.questions.length}`}
        />
        <Text style={[theme.text.sm, { color: theme.colors.fgMuted }]}>
          Question {run.index + 1} of {session.questions.length}, {question.topicName}
        </Text>
      </View>

      {isFlashcards ? (
        <>
          <Flashcard
            // A fresh card (and fresh animation state) for each question.
            key={question.id}
            front={question.text}
            back={question.options
              .filter((option) => question.correctKeys.includes(option.key))
              .map((option) => option.text)
              .join('; ')}
            footnote={question.explanation}
            flipped={run.flipped}
            lang={question.locale}
            onFlip={() => {
              haptics.select();
              setRun((current) => flipCard(config, current));
            }}
            onSwipe={submit}
          />
          {run.flipped ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Still learning"
                  variant="secondary"
                  onPress={() => submit(false)}
                  testID="still-learning"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Knew it" onPress={() => submit(true)} testID="knew-it" />
              </View>
            </View>
          ) : (
            <Button
              label="Show the answer"
              onPress={() => {
                haptics.select();
                setRun((current) => flipCard(config, current));
              }}
              testID="show-answer"
            />
          )}
          {run.flipped && (
            <Body muted size="sm">
              Swipe the card right if you knew it, left if you are still learning it.
            </Body>
          )}
        </>
      ) : (
        <>
          <Text
            accessibilityRole="header"
            accessibilityLanguage={question.locale}
            testID="question-text"
            style={[theme.text['2xl'], { color: theme.colors.fg, fontWeight: '600' }]}
          >
            {question.text}
          </Text>
          <View
            accessibilityRole={question.type === 'multi_select' ? undefined : 'radiogroup'}
            style={{ gap: theme.spacing[3] }}
          >
            {question.type === 'multi_select' && (
              <Body muted>Choose every answer that applies.</Body>
            )}
            {question.options.map((option, i) => (
              <OptionButton
                key={option.key}
                label={option.text}
                index={i}
                state={optionState(option.key)}
                multiple={question.type === 'multi_select'}
                disabled={run.phase !== 'answering'}
                onPress={() => {
                  haptics.select();
                  setRun((current) => toggleOption(config, current, option.key));
                }}
              />
            ))}
          </View>

          {given && (
            <Card>
              <Text
                accessibilityLiveRegion="polite"
                style={[
                  theme.text.lg,
                  {
                    color: given.correct ? theme.colors.successFg : theme.colors.errorFg,
                    fontWeight: '600',
                  },
                ]}
              >
                {given.correct ? 'Correct' : 'Not quite'}
              </Text>
              {question.explanation && <Body>{question.explanation}</Body>}
              {question.sourceQuote && (
                <Body muted size="sm">
                  From the official guide: “{question.sourceQuote}”
                </Body>
              )}
            </Card>
          )}

          {run.phase === 'feedback' ? (
            <Button
              label={last ? 'See results' : 'Next question'}
              onPress={() => setRun((current) => nextQuestion(config, current))}
              testID="next"
            />
          ) : (
            <Button
              label={isExam ? (last ? 'Submit exam' : 'Next') : 'Check'}
              disabled={run.selected.length === 0}
              onPress={() => submit()}
              testID={isExam ? 'next' : 'check'}
            />
          )}
        </>
      )}
    </Screen>
  );
}

export default function SessionScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useStudySession(id);

  if (session.data && session.data.questions.length > 0) {
    // Keyed, so opening another session never inherits this one's progress.
    return <Runner key={session.data.attemptId} session={session.data} />;
  }
  return (
    <Screen>
      {session.isError || session.data ? (
        <>
          <Heading>We could not open this session</Heading>
          <Body muted>
            It may have been started on another device while this phone was offline.
          </Body>
          <Button label="Back to study" onPress={backToStudy} />
        </>
      ) : (
        <ActivityIndicator accessibilityLabel="Loading your session" color={theme.colors.primary} />
      )}
    </Screen>
  );
}
