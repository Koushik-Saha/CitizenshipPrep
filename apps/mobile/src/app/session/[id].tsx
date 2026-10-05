import { questionWording, toMockExam, toQuizQuestion, type StudySession } from '@oathly/api';
import { useAudioSession } from '@oathly/api/audio-hooks';
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
import { isolate, languageName, textDirection } from '@oathly/i18n';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { AudioControls } from '@/components/audio-controls';
import { Flashcard } from '@/components/flashcard';
import { OptionButton, type OptionState } from '@/components/option-button';
import { ProgressBar } from '@/components/progress-bar';
import { Results } from '@/components/results';
import { Body, Button, Card, Heading, LinkButton, Screen, useTheme } from '@/components/ui';
import { audioPlatform } from '@/lib/audio-platform';
import { setAudioPrefs, useAudioPrefs } from '@/lib/audio-prefs';
import { haptics } from '@/lib/haptics';
import { useT } from '@/lib/i18n';
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

const modeLabel = {
  practice: 'session.practice',
  flashcards: 'session.flashcards',
  mock_exam: 'session.mockExam',
} as const;

function Runner({ session }: { session: StudySession }) {
  const theme = useTheme();
  const t = useT();
  const client = useQueryClient();
  // Study language or the exam's own, for questions that have both. The
  // choice carries on to the next question until it is changed back.
  // The real exam is an interview: asked aloud, answered aloud, no list of choices.
  const interview = session.mode === 'mock_exam' && (session.exam?.spoken ?? false);
  // A mock interview starts in the exam's language: that is what will be heard on the day.
  const [inExamLanguage, setInExamLanguage] = useState(interview);
  // Audio mode: the learner's standing choice, except that an interview is spoken unless switched off.
  const prefs = useAudioPrefs();
  const [interviewAudio, setInterviewAudio] = useState(true);
  // In an interview the written question stays out of sight until asked for, question by
  // question; choosing to tap answers instead of saying them holds for the session.
  const [textShownFor, setTextShownFor] = useState(-1);
  const [choicesShown, setChoicesShown] = useState(false);
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
  const wording = questionWording(question, inExamLanguage);
  const wordingStyle = { writingDirection: textDirection(wording.locale) };
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

  /** Submits the answer chosen on screen, a flashcard verdict, or an answer given aloud. */
  function submit(knewIt?: boolean, spoken?: readonly string[]) {
    const { state, answer } = submitAnswer(config, run, {
      now: new Date(),
      shownAt: shownAt.current,
      knewIt,
      spoken,
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

  const given = run.phase === 'feedback' ? run.answers[run.answers.length - 1]! : null;
  const audioOn =
    !isFlashcards && run.phase !== 'results' && (interview ? interviewAudio : prefs.audio);
  const audio = useAudioSession({
    platform: audioPlatform,
    enabled: audioOn,
    listen: prefs.voice,
    phase: run.phase,
    questionKey: run.index,
    wording,
    question,
    spokenExam: interview,
    correct: given?.correct ?? false,
    phrases: { locale: t.locale, correct: t('audio.correct'), notQuite: t('audio.notQuite') },
    onAnswer: (key) => submit(undefined, [key]),
    // Hands-free: once the explanation has been read, on to the next question.
    onExplained: () => setRun((current) => nextQuestion(config, current)),
  });
  // Without audio, or where answers cannot or are not to be spoken, an interview falls back
  // to the written form.
  const hideText = interview && audioOn && textShownFor !== run.index;
  const hideChoices = interview && audioOn && audio.canListen && prefs.voice && !choicesShown;

  if (run.phase === 'results') {
    return (
      <Results
        session={session}
        config={config}
        run={run}
        startedAt={startedAt}
        inExamLanguage={inExamLanguage}
      />
    );
  }

  const answered = run.answers.length;
  const last = run.index + 1 === session.questions.length;

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
          <LinkButton label={t('session.leave')} onPress={backToStudy} testID="leave-session" />
          <Text style={[theme.text.sm, { color: theme.colors.fgMuted }]}>
            {isExam ? (session.exam?.name ?? t(modeLabel.mock_exam)) : t(modeLabel[session.mode])}
          </Text>
          {remaining !== null ? (
            <Text
              accessibilityLabel={t('session.timeLeft', { time: clock(remaining) })}
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
          label={t('session.questionOf', {
            current: run.index + 1,
            total: session.questions.length,
          })}
        />
        <Text style={[theme.text.sm, { color: theme.colors.fgMuted }]}>
          {t('session.questionOf', { current: run.index + 1, total: session.questions.length })}
          {t('exam.factSeparator')}
          {question.topicName}
        </Text>
        {question.original && (
          // The real exam is in its own language: one tap shows this question
          // as the exam words it, and another brings the study language back.
          <LinkButton
            label={
              inExamLanguage
                ? t('session.showInStudyLanguage', {
                    language: languageName(question.locale, t.locale),
                  })
                : t('session.showInExamLanguage', {
                    language: languageName(question.original.locale, t.locale),
                  })
            }
            onPress={() => {
              haptics.select();
              setInExamLanguage((current) => !current);
            }}
            testID="language-toggle"
          />
        )}
      </View>

      {!isFlashcards && (
        <AudioControls
          on={audioOn}
          onToggle={() =>
            interview ? setInterviewAudio(!interviewAudio) : setAudioPrefs({ audio: !prefs.audio })
          }
          audio={audio}
          voice={prefs.voice}
          onVoiceChange={(voice) => setAudioPrefs({ voice })}
          answering={run.phase === 'answering'}
          interview={interview}
          choicesShown={!hideChoices}
          onShowChoices={() => setChoicesShown(true)}
          onUseAnswer={() => submit(undefined, [])}
        />
      )}

      {isFlashcards ? (
        <>
          <Flashcard
            // A fresh card (and fresh animation state) for each question.
            key={question.id}
            front={wording.text}
            back={wording.options
              .filter((option) => question.correctKeys.includes(option.key))
              .map((option) => option.text)
              .join('; ')}
            footnote={wording.explanation}
            flipped={run.flipped}
            lang={wording.locale}
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
                  label={t('session.stillLearning')}
                  variant="secondary"
                  onPress={() => submit(false)}
                  testID="still-learning"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={t('session.knewIt')} onPress={() => submit(true)} testID="knew-it" />
              </View>
            </View>
          ) : (
            <Button
              label={t('session.showAnswer')}
              onPress={() => {
                haptics.select();
                setRun((current) => flipCard(config, current));
              }}
              testID="show-answer"
            />
          )}
          {run.flipped && (
            <Body muted size="sm">
              {t('session.swipeHint')}
            </Body>
          )}
        </>
      ) : (
        <>
          {interview && (
            <Body muted size="sm">
              {t('audio.interviewIntro')}
            </Body>
          )}
          {hideText ? (
            <>
              <Heading level={2}>{t('audio.listenToQuestion')}</Heading>
              <LinkButton
                label={t('audio.showQuestion')}
                onPress={() => setTextShownFor(run.index)}
                testID="show-question"
              />
            </>
          ) : (
            <Text
              accessibilityRole="header"
              accessibilityLanguage={wording.locale}
              testID="question-text"
              style={[
                theme.text['2xl'],
                { color: theme.colors.fg, fontWeight: '600' },
                wordingStyle,
              ]}
            >
              {wording.text}
            </Text>
          )}
          <View
            accessibilityRole={question.type === 'multi_select' ? undefined : 'radiogroup'}
            style={{ gap: theme.spacing[3], display: hideChoices ? 'none' : 'flex' }}
          >
            {question.type === 'multi_select' && <Body muted>{t('session.chooseAll')}</Body>}
            {wording.options.map((option, i) => (
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
                {given.correct ? t('session.correct') : t('session.notQuite')}
              </Text>
              {wording.explanation && (
                <Text style={[theme.text.base, { color: theme.colors.fg }, wordingStyle]}>
                  {wording.explanation}
                </Text>
              )}
              {question.sourceQuote && (
                <Body muted size="sm">
                  {t('session.fromGuide', { quote: isolate(question.sourceQuote) })}
                </Body>
              )}
            </Card>
          )}

          {run.phase === 'feedback' ? (
            <Button
              label={last ? t('session.seeResults') : t('session.nextQuestion')}
              onPress={() => setRun((current) => nextQuestion(config, current))}
              testID="next"
            />
          ) : hideChoices ? null : (
            <Button
              label={
                isExam ? (last ? t('session.submitExam') : t('session.next')) : t('session.check')
              }
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
  const t = useT();
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
          <Heading>{t('session.openFailedTitle')}</Heading>
          <Body muted>{t('session.openFailedBody')}</Body>
          <Button label={t('common.backToStudy')} onPress={backToStudy} />
        </>
      ) : (
        <ActivityIndicator
          accessibilityLabel={t('session.loadingSession')}
          color={theme.colors.primary}
        />
      )}
    </Screen>
  );
}
