import type { StudySession } from '@oathly/api';
import {
  runResult,
  scoreAttempt,
  type RunConfig,
  type RunState,
  type StopReason,
} from '@oathly/core';
import { Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { Confetti } from '@/components/confetti';
import { Body, Button, Card, Heading, Screen, useTheme } from '@/components/ui';
import { backToStudy } from '@/lib/navigation';

const stopNotes: Partial<Record<StopReason, string>> = {
  'passed-early': 'You have reached the pass mark, so the examiner would stop here.',
  'failed-early': 'Passing is no longer possible, so the examiner would stop here.',
  'time-up': 'Time is up.',
};

/** How a session went: the score, where it was won and lost, and what to go over. */
export function Results({
  session,
  config,
  run,
  startedAt,
}: {
  session: StudySession;
  config: RunConfig;
  run: RunState;
  startedAt: Date;
}) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Reopened after it was finished: the answers are on the server, not here.
  if (session.completedAt && run.answers.length === 0) {
    return (
      <Screen>
        <Heading>This session is finished</Heading>
        <Body muted>Start a new one from your study page.</Body>
        <Button label="Back to study" onPress={backToStudy} />
      </Screen>
    );
  }

  const isFlashcards = session.mode === 'flashcards';
  const result = runResult(config, run, startedAt);
  const score = isFlashcards
    ? null
    : scoreAttempt(
        config.questions,
        run.answers,
        config.exam ? { exam: config.exam, startedAt } : {},
      );
  const topicNames = new Map(session.questions.map((q) => [q.topicId, q.topicName]));
  const byId = new Map(session.questions.map((q) => [q.id, q]));
  const wrong = run.answers.filter((answer) => !answer.correct);
  const note = run.stopReason ? stopNotes[run.stopReason] : undefined;
  const enter = (order: number) =>
    reduceMotion ? undefined : FadeInDown.delay(order * 70).duration(260);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View testID="results" style={{ gap: theme.spacing[2] }}>
          <Body muted size="sm">
            {session.exam ? session.exam.name : isFlashcards ? 'Flashcards' : 'Practice'},{' '}
            {session.countryName}
          </Body>
          <Heading>
            {result.passed === null
              ? 'Session complete'
              : result.passed
                ? 'You passed'
                : 'Not a pass this time'}
          </Heading>
          {note && <Body muted>{note}</Body>}
        </View>

        <Animated.View entering={enter(0)}>
          <Text style={[theme.text.xl, { color: theme.colors.fgMuted }]}>
            <Text style={[theme.text['5xl'], { color: theme.colors.fg, fontWeight: '600' }]}>
              {result.correct}
            </Text>{' '}
            of {result.total} {isFlashcards ? 'known' : 'correct'}
            {session.exam?.passMark != null ? `. ${session.exam.passMark} needed to pass.` : '.'}
          </Text>
          {score?.exam?.reasons.map((reason) => (
            <Text key={reason} style={[theme.text.base, { color: theme.colors.errorFg }]}>
              {reason}
            </Text>
          ))}
        </Animated.View>

        {score && (
          <Animated.View entering={enter(1)} style={{ gap: theme.spacing[2] }}>
            <Heading level={2}>By topic</Heading>
            {Object.entries(score.byTopic).map(([topicId, topic]) => (
              <View
                key={topicId}
                accessible
                accessibilityLabel={`${topicNames.get(topicId)}: ${topic.correct} of ${topic.total} correct`}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: theme.spacing[2],
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <Body>{topicNames.get(topicId)}</Body>
                <Body>
                  {topic.correct} of {topic.total}
                </Body>
              </View>
            ))}
          </Animated.View>
        )}

        <Animated.View entering={enter(2)} style={{ gap: theme.spacing[3] }}>
          <Heading level={2}>
            {wrong.length === 0
              ? 'Nothing to review'
              : isFlashcards
                ? 'Cards to go over again'
                : 'Review your wrong answers'}
          </Heading>
          {wrong.map((answer) => {
            const question = byId.get(answer.questionId)!;
            const text = (keys: readonly string[]) =>
              question.options
                .filter((option) => keys.includes(option.key))
                .map((option) => option.text)
                .join('; ');
            return (
              <Card key={answer.questionId}>
                <Text
                  accessibilityLanguage={question.locale}
                  style={[theme.text.base, { color: theme.colors.fg, fontWeight: '600' }]}
                >
                  {question.text}
                </Text>
                {!isFlashcards && (
                  <Text style={[theme.text.base, { color: theme.colors.errorFg }]}>
                    You answered: {text(answer.selectedKeys) || 'nothing'}
                  </Text>
                )}
                <Text style={[theme.text.base, { color: theme.colors.successFg }]}>
                  Correct answer: {text(question.correctKeys)}
                </Text>
                {question.explanation && <Body muted>{question.explanation}</Body>}
                {question.sourceQuote && (
                  <Body muted size="sm">
                    From the official guide: “{question.sourceQuote}”
                  </Body>
                )}
              </Card>
            );
          })}
        </Animated.View>

        <Button label="Back to study" onPress={backToStudy} testID="back-to-study" />
      </Screen>
      {result.passed && !reduceMotion && (
        <Confetti
          width={width}
          height={height}
          colors={[
            theme.palette.gold[400],
            theme.palette.navy[400],
            theme.palette.success[400],
            theme.palette.gold[200],
          ]}
        />
      )}
    </View>
  );
}
