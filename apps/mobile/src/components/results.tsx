import { questionWording, type StudySession } from '@oathly/api';
import {
  runResult,
  scoreAttempt,
  type RunConfig,
  type RunState,
  type StopReason,
} from '@oathly/core';
import { countryName, isolate, textDirection, type MessageKey } from '@oathly/i18n';
import { Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { Confetti } from '@/components/confetti';
import { Body, Button, Card, Heading, Screen, useTheme } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { backToStudy } from '@/lib/navigation';

const stopNotes: Partial<Record<StopReason, MessageKey>> = {
  'passed-early': 'results.stoppedPassed',
  'failed-early': 'results.stoppedFailed',
  'time-up': 'results.timeUp',
};

/** How a session went: the score, where it was won and lost, and what to go over. */
export function Results({
  session,
  config,
  run,
  startedAt,
  inExamLanguage,
}: {
  session: StudySession;
  config: RunConfig;
  run: RunState;
  startedAt: Date;
  /** Whether the learner was reading the questions as the exam words them. */
  inExamLanguage: boolean;
}) {
  const theme = useTheme();
  const t = useT();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Reopened after it was finished: the answers are on the server, not here.
  if (session.completedAt && run.answers.length === 0) {
    return (
      <Screen>
        <Heading>{t('session.finishedTitle')}</Heading>
        <Body muted>{t('session.finishedBody')}</Body>
        <Button label={t('common.backToStudy')} onPress={backToStudy} />
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
            {session.exam
              ? session.exam.name
              : isFlashcards
                ? t('session.flashcards')
                : t('session.practice')}
            {t('exam.factSeparator')}
            {countryName(session.countryCode, t.locale, session.countryName)}
          </Body>
          <Heading>
            {result.passed === null
              ? t('results.complete')
              : result.passed
                ? t('results.passed')
                : t('results.notPassed')}
          </Heading>
          {note && <Body muted>{t(note)}</Body>}
        </View>

        <Animated.View entering={enter(0)}>
          <Text style={[theme.text.xl, { color: theme.colors.fgMuted }]}>
            <Text style={[theme.text['5xl'], { color: theme.colors.fg, fontWeight: '600' }]}>
              {result.correct}
            </Text>{' '}
            {t(isFlashcards ? 'results.knownOf' : 'results.correctOf', { total: result.total })}
            {session.exam?.passMark != null
              ? ` ${t('results.neededToPass', { count: session.exam.passMark })}`
              : ''}
          </Text>
          {/* Missing the pass mark is said above; a section that had to be perfect is said here. */}
          {score?.exam?.sections
            .filter((section) => !section.passed)
            .map((section) => (
              <Text key={section.id} style={[theme.text.base, { color: theme.colors.errorFg }]}>
                {t('results.sectionAllCorrect', {
                  section: isolate(section.label),
                  correct: section.correct,
                  total: section.total,
                })}
              </Text>
            ))}
        </Animated.View>

        {score && (
          <Animated.View entering={enter(1)} style={{ gap: theme.spacing[2] }}>
            <Heading level={2}>{t('results.byTopic')}</Heading>
            {Object.entries(score.byTopic).map(([topicId, topic]) => (
              <View
                key={topicId}
                accessible
                accessibilityLabel={`${topicNames.get(topicId)}: ${t('results.scoreOf', { correct: topic.correct, total: topic.total })}`}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: theme.spacing[2],
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <Body>{topicNames.get(topicId)}</Body>
                <Body>{t('results.scoreOf', { correct: topic.correct, total: topic.total })}</Body>
              </View>
            ))}
          </Animated.View>
        )}

        <Animated.View entering={enter(2)} style={{ gap: theme.spacing[3] }}>
          <Heading level={2}>
            {wrong.length === 0
              ? t('results.nothingToReview')
              : isFlashcards
                ? t('results.reviewCards')
                : t('results.reviewWrong')}
          </Heading>
          {wrong.map((answer) => {
            const question = byId.get(answer.questionId)!;
            const wording = questionWording(question, inExamLanguage);
            const wordingStyle = { writingDirection: textDirection(wording.locale) };
            const text = (keys: readonly string[]) =>
              wording.options
                .filter((option) => keys.includes(option.key))
                .map((option) => option.text)
                .join('; ');
            return (
              <Card key={answer.questionId}>
                <Text
                  accessibilityLanguage={wording.locale}
                  style={[
                    theme.text.base,
                    { color: theme.colors.fg, fontWeight: '600' },
                    wordingStyle,
                  ]}
                >
                  {wording.text}
                </Text>
                {!isFlashcards && (
                  <Text style={[theme.text.base, { color: theme.colors.errorFg }]}>
                    {t('results.youAnswered', {
                      answer:
                        answer.selectedKeys.length > 0
                          ? isolate(text(answer.selectedKeys))
                          : t('results.nothing'),
                    })}
                  </Text>
                )}
                <Text style={[theme.text.base, { color: theme.colors.successFg }]}>
                  {t('results.correctAnswer', { answer: isolate(text(question.correctKeys)) })}
                </Text>
                {wording.explanation && (
                  <Text style={[theme.text.base, { color: theme.colors.fgMuted }, wordingStyle]}>
                    {wording.explanation}
                  </Text>
                )}
                {question.sourceQuote && (
                  <Body muted size="sm">
                    {t('session.fromGuide', { quote: isolate(question.sourceQuote) })}
                  </Body>
                )}
              </Card>
            );
          })}
        </Animated.View>

        <Button label={t('common.backToStudy')} onPress={backToStudy} testID="back-to-study" />
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
