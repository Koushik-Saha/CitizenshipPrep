import {
  daysUntilExam,
  type CountryDashboard,
  type StartSessionRequest,
  type StudySuggestionView,
} from '@oathly/api';
import { useDashboard } from '@oathly/api/hooks';
import { queryKeys } from '@oathly/api/queries';
import { countryName, type Translator } from '@oathly/i18n';
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
import { useT } from '@/lib/i18n';
import { downloadPack, startSession, useOffline } from '@/lib/offline';
import { useSession } from '@/lib/session';

function countdown(days: number | null, t: Translator): string {
  if (days === null) return t('exam.countdownNone');
  if (days < 0) return t('exam.countdownPassed');
  if (days === 0) return t('exam.countdownToday');
  return t('exam.countdownDays', { count: days });
}

/** The readiness score: a Skia gauge that sweeps up to it, with the number in words too. */
function Readiness({ country }: { country: CountryDashboard }) {
  const theme = useTheme();
  const t = useT();
  const readiness = country.readiness!;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${t('readiness.title')}: ${t(readiness.isEarlyEstimate ? 'readiness.meterEarly' : 'readiness.meter', { score: readiness.score })}`}
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
          {readiness.isEarlyEstimate ? t('readiness.earlyTitle') : t('readiness.title')}
        </Text>
      </View>
    </View>
  );
}

/** What a "study next" suggestion says, and the session it starts. */
function suggestion(
  countryCode: string,
  item: StudySuggestionView,
  t: Translator,
): { title: string; detail: string; action: string; request: StartSessionRequest } {
  const practise = (focus: 'adaptive' | { topicId: string }): StartSessionRequest => ({
    kind: 'practice',
    countryCode,
    focus,
    size: 10,
  });
  switch (item.kind) {
    case 'start':
      return {
        title: t('readiness.suggestStart'),
        detail: t('readiness.suggestStartDetail'),
        action: t('readiness.start'),
        request: practise('adaptive'),
      };
    case 'review':
      return {
        title: t('readiness.suggestReview', { count: item.count }),
        detail: t('readiness.suggestReviewDetail'),
        action: t('readiness.start'),
        request: practise('adaptive'),
      };
    case 'topic':
      return {
        title: item.name,
        detail: t('readiness.suggestTopicDetail', { share: item.share, mastery: item.mastery }),
        action: t('dashboard.practise'),
        request: practise({ topicId: item.topicId }),
      };
    case 'mock':
      return {
        title: t('readiness.suggestMock'),
        detail: t('readiness.suggestMockDetail', { exam: item.examName }),
        action: t('readiness.start'),
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
  const t = useT();
  const offline = useOffline();
  const [showTopics, setShowTopics] = useState(false);
  const [packProblem, setPackProblem] = useState<string | null>(null);
  const code = country.countryCode;
  const pack = offline.packs[code];
  const name = countryName(code, t.locale, country.countryName);
  const dateFormat = new Intl.DateTimeFormat(t.locale, { dateStyle: 'medium' });
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
        <Heading level={2}>{name}</Heading>
        <Body muted>{countdown(daysUntilExam({ ...country, studyLocale: null }), t)}</Body>
        <Body muted>{t('dashboard.questionsReady', { count: country.publishedQuestions })}</Body>
      </View>

      {country.publishedQuestions === 0 ? (
        <Card>
          <Body muted>{t('dashboard.questionsBeingChecked', { country: name })}</Body>
        </Card>
      ) : (
        <>
          <Card>
            <Readiness country={country} />
            {country.readiness!.suggestions.slice(0, 2).map((item) => {
              const { title, detail, action, request } = suggestion(code, item, t);
              return (
                <View key={`${item.kind}-${title}`} style={{ gap: theme.spacing[1] }}>
                  <Body>{title}</Body>
                  <Body muted size="sm">
                    {detail}
                  </Body>
                  <LinkButton label={action} onPress={() => onStart(`suggest-${code}`, request)} />
                </View>
              );
            })}
          </Card>

          <Card>
            <Text style={[theme.text.lg, { color: theme.colors.fg, fontWeight: '600' }]}>
              {t('dashboard.practise')}
            </Text>
            <Body muted size="sm">
              {country.dueForReview > 0
                ? t('start.practiceIntroDue', { count: country.dueForReview })
                : t('start.practiceIntro')}
            </Body>
            <Button
              label={t('dashboard.practise')}
              busy={busy === `practise-${code}`}
              disabled={busy !== null}
              onPress={() => onStart(`practise-${code}`, practise('adaptive'))}
              testID={`practise-${code}`}
            />
            <Button
              label={t('start.flashcards')}
              variant="secondary"
              busy={busy === `flashcards-${code}`}
              disabled={busy !== null}
              onPress={() => onStart(`flashcards-${code}`, practise('adaptive', 'flashcards'))}
              testID={`flashcards-${code}`}
            />
            <LinkButton
              label={showTopics ? t('start.hideTopics') : t('start.oneTopic')}
              onPress={() => setShowTopics(!showTopics)}
            />
            {showTopics &&
              country.topics.map((topic) => (
                <Button
                  key={topic.topicId}
                  label={t('start.topicWithMastery', { topic: topic.name, mastery: topic.mastery })}
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
              {t('dashboard.mockExam')}
            </Text>
            {country.exams.map((exam, i) => (
              <View key={exam.id} style={{ gap: theme.spacing[2] }}>
                <Body>{exam.name}</Body>
                <Body muted size="sm">
                  {[
                    t('exam.questionCount', { count: exam.questionCount }),
                    exam.passMark !== null ? t('exam.toPass', { count: exam.passMark }) : null,
                    exam.timeLimitMinutes !== null
                      ? t('exam.minutes', { count: exam.timeLimitMinutes })
                      : t('exam.noTimeLimit'),
                  ]
                    .filter((part) => part !== null)
                    .join(t('exam.factSeparator'))}
                </Body>
                {exam.unavailableReason && (
                  <Body muted size="sm">
                    {exam.unavailableReason}
                  </Body>
                )}
                <Button
                  label={t('start.startMock')}
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
              {t('offline.title')}
            </Text>
            <Body muted size="sm">
              {pack
                ? t('offline.saved', {
                    count: pack.questions,
                    date: dateFormat.format(new Date(pack.generatedAt)),
                  })
                : t('offline.notSaved')}
            </Body>
            {packProblem && <Message tone="error">{packProblem}</Message>}
            <Button
              label={pack ? t('offline.update') : t('offline.save')}
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
  const t = useT();
  const session = useSession();
  const dashboard = useDashboard();
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const offline = useOffline();

  // Opened directly (a deep link) before the session is known: wait, do not bounce.
  if (session.status === 'loading') return <LoadingScreen label={t('common.loading')} />;
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
      <Heading>
        {me.profile.displayName
          ? t('dashboard.greeting', { name: me.profile.displayName })
          : t('dashboard.title')}
      </Heading>
      {problem && <Message tone="error">{problem}</Message>}

      {data ? (
        <>
          <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
            <Card style={{ flex: 1, alignItems: 'center' }}>
              <View
                accessible
                accessibilityLabel={`${t('dashboard.todaysGoal')}: ${data.minutesToday} ${t('dashboard.goalProgress', { goal: data.dailyGoalMinutes })}`}
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
                {t('dashboard.goalProgressToday', { goal: data.dailyGoalMinutes })}
              </Body>
            </Card>
            <Card style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[theme.text['4xl'], { color: theme.colors.fg, fontWeight: '600' }]}>
                {data.streakDays}
              </Text>
              <Body muted size="sm">
                {t('dashboard.streakDays', { count: data.streakDays })}
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
          <Body muted>{t('offline.progressLater')}</Body>
          {me.studyCountries
            .filter((country) => offline.packs[country.countryCode])
            .map((country) => (
              <Card key={country.countryCode}>
                <Heading level={2}>
                  {countryName(country.countryCode, t.locale, country.countryName)}
                </Heading>
                <Button
                  label={t('dashboard.practise')}
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
          <Body>{t('dashboard.loadFailed')}</Body>
          <Button
            label={t('common.tryAgain')}
            variant="secondary"
            onPress={() => void dashboard.refetch()}
          />
        </Card>
      ) : (
        <ActivityIndicator
          accessibilityLabel={t('dashboard.loadingPlan')}
          color={theme.colors.primary}
        />
      )}
    </Screen>
  );
}
