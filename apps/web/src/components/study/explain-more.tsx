'use client';

import { useState } from 'react';

import { buttonClass } from '@/components/ui';
import { streamText } from '@/lib/stream-text';

type State =
  | { step: 'idle' }
  | { step: 'loading'; text: string }
  | { step: 'done'; text: string; locale: string | null }
  | { step: 'error'; message: string };

/** "Explain more": a fuller explanation, written by AI from the question's source passage. */
export function ExplainMore({ questionId }: { questionId: string }) {
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
      setState({ step: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  if (state.step === 'idle') {
    return (
      <button type="button" onClick={() => void load()} className={`${buttonClass.secondary} mt-3`}>
        Explain more
      </button>
    );
  }
  if (state.step === 'error') {
    return <p className="text-error-fg mt-3 text-sm">{state.message}</p>;
  }
  return (
    <div
      className="border-border mt-3 border-l-4 pl-4"
      aria-live="polite"
      aria-busy={state.step === 'loading'}
    >
      <p
        className="text-fg whitespace-pre-line"
        lang={state.step === 'done' ? (state.locale ?? undefined) : undefined}
      >
        {state.text || 'Writing an explanation…'}
      </p>
      <p className="text-fg-subtle mt-2 text-xs">
        Written by AI from the official guide’s passage. It has not been checked by a reviewer and
        may contain mistakes.
      </p>
    </div>
  );
}
