'use client';

import type { AudioSession } from '@oathly/api/audio-hooks';
import { isolate } from '@oathly/i18n';

import { useT } from '@/components/i18n/provider';
import { buttonClass, focusRing } from '@/components/ui';

const link = `${focusRing} text-primary-fg rounded-xs font-medium underline underline-offset-4`;

/**
 * Audio mode's controls on a session screen: on and off, read it again,
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
    <section aria-label={t('audio.mode')} className="border-border mt-6 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        <button
          type="button"
          aria-pressed={on}
          onClick={onToggle}
          className={`${on ? buttonClass.primary : buttonClass.secondary} !px-4 !py-2`}
        >
          {t('audio.mode')}
        </button>
        {on && (
          <button type="button" onClick={audio.replay} className={link}>
            {t('audio.replay')}
          </button>
        )}
        {on &&
          audio.canListen &&
          answering &&
          (audio.status === 'listening' ? (
            <button type="button" onClick={audio.stop} className={link}>
              {t('audio.stopListening')}
            </button>
          ) : (
            <button type="button" onClick={audio.listenNow} className={link}>
              {t('audio.speak')}
            </button>
          ))}
        {on && audio.canListen && (
          <label className="ms-auto flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={voice}
              onChange={(event) => onVoiceChange(event.target.checked)}
              className="accent-primary size-4"
            />
            {t('audio.voiceAnswers')}
          </label>
        )}
      </div>
      <p role="status" className="text-fg-muted mt-3 min-h-5 text-sm">
        {status}
      </p>
      {on && audio.micBlocked && (
        <p role="alert" className="text-error-fg mt-2 text-sm">
          {t('audio.micBlocked')}
        </p>
      )}
      {on && interview && !audio.canListen && (
        <p className="text-fg-muted mt-2 text-sm">{t('audio.voiceUnavailable')}</p>
      )}
      {on && audio.heard && (
        <div role="status" className="bg-surface-sunken mt-3 rounded-md p-3 text-sm">
          <p className="font-medium">{t('audio.heard', { words: isolate(audio.heard) })}</p>
          <p className="text-fg-muted mt-1">{t('audio.notCaught')}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            <button type="button" onClick={audio.listenNow} className={link}>
              {t('audio.sayAgain')}
            </button>
            {interview && (
              <button type="button" onClick={onUseAnswer} className={link}>
                {t('audio.useAnswer')}
              </button>
            )}
            {interview && !choicesShown && (
              <button type="button" onClick={onShowChoices} className={link}>
                {t('audio.showChoices')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
