import type { AudioSession } from '@oathly/api/audio-hooks';
import { isolate } from '@oathly/i18n';
import { Switch, Text, View } from 'react-native';

import { Body, Button, Card, LinkButton, Message, useTheme } from '@/components/ui';
import { useT } from '@/lib/i18n';

/**
 * Audio mode's controls on the session screen: on and off, read it again,
 * answer aloud, and what to do when a spoken answer matched nothing.
 * Everything audio does is also on the screen, so it is never the only way.
 */
export function AudioControls({
  on,
  onToggle,
  audio,
  voice,
  onVoiceChange,
  answering,
  interview,
  choicesShown,
  onShowChoices,
  onUseAnswer,
}: {
  on: boolean;
  onToggle: () => void;
  audio: AudioSession;
  /** Listen for an answer after each question is read. */
  voice: boolean;
  onVoiceChange: (voice: boolean) => void;
  /** A question is waiting for its answer. */
  answering: boolean;
  /** A spoken exam: the answer is given aloud, and no choices are read out. */
  interview: boolean;
  choicesShown: boolean;
  onShowChoices: () => void;
  /** Give what was heard as the answer, though it matched no option. */
  onUseAnswer: () => void;
}) {
  const theme = useTheme();
  const t = useT();
  const status = !on
    ? t('audio.hint')
    : audio.status === 'listening'
      ? t('audio.listening')
      : audio.status === 'speaking'
        ? t('audio.speaking')
        : answering && audio.canListen && !interview
          ? t('audio.sayNumber')
          : '';
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[theme.text.base, { color: theme.colors.fg, fontWeight: '600' }]}>
          {t('audio.mode')}
        </Text>
        <Switch
          accessibilityLabel={t('audio.mode')}
          value={on}
          onValueChange={onToggle}
          testID="audio-mode"
        />
      </View>
      {status !== '' && (
        <Text
          accessibilityLiveRegion="polite"
          testID="audio-status"
          style={[theme.text.sm, { color: theme.colors.fgMuted }]}
        >
          {status}
        </Text>
      )}
      {on && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.spacing[5] }}>
          <LinkButton label={t('audio.replay')} onPress={audio.replay} testID="audio-replay" />
          {audio.canListen &&
            answering &&
            (audio.status === 'listening' ? (
              <LinkButton label={t('audio.stopListening')} onPress={audio.stop} />
            ) : (
              <LinkButton label={t('audio.speak')} onPress={audio.listenNow} testID="audio-speak" />
            ))}
        </View>
      )}
      {on && audio.canListen && (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Body size="sm">{t('audio.voiceAnswers')}</Body>
          <Switch
            accessibilityLabel={t('audio.voiceAnswers')}
            value={voice}
            onValueChange={onVoiceChange}
          />
        </View>
      )}
      {on && audio.micBlocked && <Message tone="error">{t('audio.micBlocked')}</Message>}
      {on && interview && !audio.canListen && (
        <Body muted size="sm">
          {t('audio.voiceUnavailable')}
        </Body>
      )}
      {on && audio.heard && (
        <View
          accessibilityLiveRegion="polite"
          testID="audio-heard"
          style={{ gap: theme.spacing[1] }}
        >
          <Body>{t('audio.heard', { words: isolate(audio.heard) })}</Body>
          <Body muted size="sm">
            {t('audio.notCaught')}
          </Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.spacing[5] }}>
            <LinkButton label={t('audio.sayAgain')} onPress={audio.listenNow} />
            {interview && (
              <LinkButton label={t('audio.useAnswer')} onPress={onUseAnswer} testID="audio-use" />
            )}
            {interview && !choicesShown && (
              <LinkButton label={t('audio.showChoices')} onPress={onShowChoices} />
            )}
          </View>
        </View>
      )}
      {on && !audio.heard && interview && !choicesShown && (
        <Button
          label={t('audio.showChoices')}
          variant="secondary"
          onPress={onShowChoices}
          testID="show-choices"
        />
      )}
    </Card>
  );
}
