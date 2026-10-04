import {
  daysUntilExam,
  type CountryDashboard,
  type StartSessionRequest,
  type StudySuggestionView,
} from '@oathly/api';
import { useDashboard } from '@oathly/api/hooks';
import { queryKeys } from '@oathly/api/queries';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { OfflineBanner } from '@/components/offline-banner';
import { Arc } from '@/components/skia';
import {
  Body,
  Button,
  Card,
  Heading,
  LinkButton,
  LoadingScreen,
  Message,
  Screen,
  useTheme,
} from '@/components/ui';
import { downloadPack, startSession, useOffline } from '@/lib/offline';
import { useSession } from '@/lib/session';

function countdown(days: number | null): string {
  if (days === null) return 'No exam date set';
  if (days < 0) return 'Exam date has passed';
  if (days === 0) return 'Exam today';
  return days === 1 ? 'Exam tomorrow' : `Exam in ${days} days`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

/** The readiness score: a Skia gauge that sweeps up to it, with the number in words too. */
function Readiness({ country }: { country: CountryDashboard }) {
  const theme = useTheme();
  const readiness = country.readiness!;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Estimated readiness ${readiness.score} percent${readiness.isEarlyEstimate ? ', an early estimate' : ''}`}
      style={{ alignItems: 'center' }}
    >
      <Arc
        value={readiness.score / 100}
        size={220}
        shape="half"
        trackColor={theme.colors.surfaceSunken}
        fillColor={theme.colors.accent}
      />
      <View style={{ marginTop: -64, alignItems: 'center' }}>
        <Text style={[theme.text['5xl'], { color: theme.colors.fg, fontWeight: '600' }]}>
          {readiness.score}%
        </Text>
        <Text style={[theme.text.sm, { color: theme.colors.fgMuted }]}>
          {readiness.isEarlyEstimate ? 'Early estimate of readiness' : 'Estimated readiness'}
        </Text>
      </View>
    </View>
  );
}

/** What a "study next" suggestion says, and the session it starts. */
function suggestion(
  countryCode: string,
  item: StudySuggestionView,
): { text: string; action: string; request: StartSessionRequest } {
  const practise = (focus: 'adaptive' | { topicId: string }): StartSessionRequest => ({
    kind: 'practice',
    countryCode,
    focus,
    size: 10,
  });
  switch (item.kind) {
    case 'start':
      return {
        text: 'Answer a few questions to get your first estimate.',
        action: 'Start',
        request: practise('adaptive'),
      };
    case 'review':
      return {
        text: `${item.count} ${item.count === 1 ? 'question is' : 'questions are'} due for review.`,
        action: 'Review',
        request: practise('adaptive'),
      };
    case 'topic':
      return {
        text: `${item.name} is ${item.share}% of the exam and you are at ${item.mastery}%.`,
        action: 'Practise it',
        request: practise({ topicId: item.topicId }),
      };
    case 'mock':
      return {
        text: `You look ready to try the ${item.examName}.`,
        action: 'Take a mock exam',
        request: { kind: 'mock_exam', countryCode, examFormatId: item.examFormatId },
      };
  }
}

function CountrySection({
  country,
  busy,
  onStart,
}: {
  country: CountryDashboard;
  /** The key of the session being started, if any. */
  busy: string | null;
  onStart: (key: string, request: StartSessionRequest) => void;
}) {
  const theme = useTheme();
  const offline = useOffline();
  const [showTopics, setShowTopics] = useState(false);
  const [packProblem, setPackProblem] = useState<string | null>(null);
  const code = country.countryCode;
  const pack = offline.packs[code];
  const practise = (
    focus: 'adaptive' | 'random' | { topicId: string },
    kind: 'practice' | 'flashcards' = 'practice',
  ): StartSessionRequest => ({ kind, countryCode: code, focus, size: 10 });

  async function savePack() {
    setPackProblem(null);
    try {
      await downloadPack(code);
    } catch (error) {
      setPackProblem(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <View style={{ gap: theme.spacing[4] }}>
      <View style={{ gap: theme.spacing[1] }}>
        <Heading level={2}>{country.countryName}</Heading>
        <Body muted>
          {countdown(daysUntilExam({ ...country, studyLocale: null }))}.{' '}
          {country.publishedQuestions} questions ready to study.
        </Body>
      </View>

      {country.publishedQuestions === 0 ? (
        <Card>
          <Body muted>
            Questions for {country.countryName} are still being checked against the official guide.
            They appear here once a reviewer has verified them.
          </Body>
        </Card>
      ) : (
        <>
          <Card>
            <Readiness country={country} />
            {country.readiness!.suggestions.slice(0, 2).map((item) => {
              const { text, action, request } = suggestion(code, item);
              return (
                <View key={`${item.kind}-${text}`} style={{ gap: theme.spacing[1] }}>
                  <Body>{text}</Body>
                  <LinkButton label={action} onPress={() => onStart(`suggest-${code}`, request)} />
                </View>
              );
            })}
          </Card>

          <Card>
            <Text style={[theme.text.lg, { color: theme.colors.fg, fontWeight: '600' }]}>
              Practise
            </Text>
            <Body muted size="sm">
              Ten questions chosen for you: weak topics, reviews
              {country.dueForReview > 0 ? ` (${country.dueForReview} due)` : ''} and new ones.
            </Body>
            <Button
              label="Practise"
              busy={busy === `practise-${code}`}
              disabled={busy !== null}
              onPress={() => onStart(`practise-${code}`, practise('adaptive'))}
              testID={`practise-${code}`}
            />
            <Button
              label="Flashcards"
              variant="secondary"
              busy={busy === `flashcards-${code}`}
              disabled={busy !== null}
              onPress={() => onStart(`flashcards-${code}`, practise('adaptive', 'flashcards'))}
              testID={`flashcards-${code}`}
            />
            <LinkButton
              label={showTopics ? 'Hide topics' : 'Practise one topic'}
              onPress={() => setShowTopics(!showTopics)}
            />
            {showTopics &&
              country.topics.map((topic) => (
                <Button
                  key={topic.topicId}
                  label={`${topic.name} (${topic.mastery}%)`}
                  variant="secondary"
                  disabled={busy !== null}
                  onPress={() =>
                    onStart(`topic-${topic.topicId}`, practise({ topicId: topic.topicId }))
                  }
                />
              ))}
          </Card>

          <Card>
            <Text style={[theme.text.lg, { color: theme.colors.fg, fontWeight: '600' }]}>
              Mock exam
            </Text>
            {country.exams.map((exam, i) => (
              <View key={exam.id} style={{ gap: theme.spacing[2] }}>
                <Body>{exam.name}</Body>
                <Body muted size="sm">
                  {exam.questionCount} questions
                  {exam.passMark !== null ? `, ${exam.passMark} to pass` : ''}
                  {exam.timeLimitMinutes !== null
                    ? `, ${exam.timeLimitMinutes} minutes`
                    : ', no time limit'}
                  {exam.unavailableReason ? `. ${exam.unavailableReason}` : ''}
                </Body>
                <Button
                  label="Start mock exam"
                  variant="secondary"
                  busy={busy === `mock-${exam.id}`}
                  disabled={busy !== null || exam.unavailableReason !== null}
                  onPress={() =>
                    onStart(`mock-${exam.id}`, {
                      kind: 'mock_exam',
                      countryCode: code,
                      examFormatId: exam.id,
                    })
                  }
                  testID={`mock-exam-${code}-${i}`}
                />
              </View>
            ))}
          </Card>

          <Card>
            <Text style={[theme.text.lg, { color: theme.colors.fg, fontWeight: '600' }]}>
              Study offline
            </Text>
            <Body muted size="sm">
              {pack
                ? `${pack.questions} questions saved on this phone, as of ${dateFormat.format(new Date(pack.generatedAt))}. You can practise and take mock exams with no connection.`
                : 'Save this country to your phone to practise and take mock exams with no connection. Your answers are sent when you are back online.'}
            </Body>
            {packProblem && <Message tone="error">{packProblem}</Message>}
            <Button
              label={pack ? 'Update saved questions' : 'Save for offline'}
              variant="secondary"
              busy={offline.downloading === code}
              disabled={!offline.online || offline.downloading !== null}
              onPress={() => void savePack()}
              testID={`save-offline-${code}`}
            />
          </Card>
        </>
      )}
    </View>
  );
}

export default function Study() {
  const theme = useTheme();
  const session = useSession();
  const dashboard = useDashboard();
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const offline = useOffline();

  // Opened directly (a deep link) before the session is known: wait, do not bounce.
  if (session.status === 'loading') return <LoadingScreen label="Loading" />;
  if (session.status !== 'signed-in') return <Redirect href="/" />;
  const { me } = session;

  async function start(key: string, request: StartSessionRequest) {
    setBusy(key);
    setProblem(null);
    try {
      const { session: started } = await startSession(request);
      // The session screen reads it from the cache: no second request, and it
      // works for a session that only exists on this phone.
      client.setQueryData(queryKeys.session(started.attemptId), started);
      router.push(`/session/${started.attemptId}`);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  const data = dashboard.data;
  const goal = data ? Math.min(1, data.minutesToday / data.dailyGoalMinutes) : 0;

  return (
    <Screen>
      <OfflineBanner />
      <Heading>{me.profile.displayName ? `Hi, ${me.profile.displayName}` : 'Your study'}</Heading>
      {problem && <Message tone="error">{problem}</Message>}

      {data ? (
        <>
          <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
            <Card style={{ flex: 1, alignItems: 'center' }}>
              <View
                accessible
                accessibilityLabel={`Today: ${data.minutesToday} of ${data.dailyGoalMinutes} minutes`}
                style={{ alignItems: 'center', justifyContent: 'center' }}
              >
                <Arc
                  value={goal}
                  size={96}
                  shape="full"
                  stroke={10}
                  trackColor={theme.colors.surfaceSunken}
                  fillColor={theme.colors.success}
                />
                <Text
                  style={[
                    theme.text['2xl'],
                    { position: 'absolute', color: theme.colors.fg, fontWeight: '600' },
                  ]}
                >
                  {data.minutesToday}
                </Text>
              </View>
              <Body muted size="sm">
                of {data.dailyGoalMinutes} minutes today
              </Body>
            </Card>
            <Card style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[theme.text['4xl'], { color: theme.colors.fg, fontWeight: '600' }]}>
                {data.streakDays}
              </Text>
              <Body muted size="sm">
                {data.streakDays === 1 ? 'day' : 'days'} in a row
              </Body>
            </Card>
          </View>
          {data.countries.map((country) => (
            <CountrySection
              key={country.countryCode}
              country={country}
              busy={busy}
              onStart={(key, request) => void start(key, request)}
            />
          ))}
        </>
      ) : !offline.online ? (
        // First launch with no connection and nothing cached: saved countries still work.
        <>
          <Body muted>Your progress will show here when you are back online.</Body>
          {me.studyCountries
            .filter((country) => offline.packs[country.countryCode])
            .map((country) => (
              <Card key={country.countryCode}>
                <Heading level={2}>{country.countryName}</Heading>
                <Button
                  label="Practise"
                  busy={busy === `practise-${country.countryCode}`}
                  disabled={busy !== null}
                  onPress={() =>
                    void start(`practise-${country.countryCode}`, {
                      kind: 'practice',
                      countryCode: country.countryCode,
                      focus: 'adaptive',
                      size: 10,
                    })
                  }
                />
              </Card>
            ))}
        </>
      ) : dashboard.isError ? (
        <Card>
          <Body>We could not load your study plan.</Body>
          <Button label="Try again" variant="secondary" onPress={() => void dashboard.refetch()} />
        </Card>
      ) : (
        <ActivityIndicator
          accessibilityLabel="Loading your study plan"
          color={theme.colors.primary}
        />
      )}
    </Screen>
  );
}
