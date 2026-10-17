'use client';

import { useState } from 'react';

import { useT } from '@/components/i18n/provider';
import { buttonClass } from '@/components/ui';
import { isAiDown, streamText } from '@/lib/stream-text';

type State =
  | { step: 'idle' }
  | { step: 'loading'; text: string }
  | { step: 'done'; text: string; locale: string | null }
  | { step: 'error'; message: string };

/** "Explain more": a fuller explanation, written by AI from the question's source passage. */
export function ExplainMore({ questionId }: { questionId: string }) {
  const t = useT();
  const [state, setState] = useState<State>({ step: 'idle' });

  async function load() {
    setState({ step: 'loading', text: '' });
    let text = '';
    try {
      const response = await streamText('/api/explain', { questionId }, (piece) => {
        text += piece;
        setState({ step: 'loading', text });
      });
      setState({ step: 'done', text, locale: response.headers.get('content-language') });
    } catch (error) {
      setState({
        step: 'error',
        message: isAiDown(error)
          ? t('explain.unavailable')
          : error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  if (state.step === 'idle') {
    return (
      <button type="button" onClick={() => void load()} className={`${buttonClass.secondary} mt-3`}>
        {t('explain.more')}
      </button>
    );
  }
  if (state.step === 'error') {
    // A failure is often brief (a busy model, a dropped connection): asking
    // again is one press away.
    return (
      <div className="mt-3">
        <p role="alert" className="text-error-fg text-sm">
          {state.message}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className={`${buttonClass.secondary} mt-2`}
        >
          {t('common.tryAgain')}
        </button>
      </div>
    );
  }
  return (
    <div
      className="border-border mt-3 border-s-4 ps-4"
      aria-live="polite"
      aria-busy={state.step === 'loading'}
    >
      <p
        className="text-fg whitespace-pre-line"
        dir="auto"
        lang={state.step === 'done' ? (state.locale ?? undefined) : undefined}
      >
        {state.text || t('explain.writing')}
      </p>
      <p className="text-fg-subtle mt-2 text-xs">{t('explain.aiNote')}</p>
    </div>
  );
}
