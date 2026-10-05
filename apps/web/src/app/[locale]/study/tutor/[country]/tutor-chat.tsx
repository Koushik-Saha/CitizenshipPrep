'use client';

import { useRef, useState } from 'react';

import { useT } from '@/components/i18n/provider';
import { buttonClass, fieldClass, Notice } from '@/components/ui';
import { streamText } from '@/lib/stream-text';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function TutorChat({
  countryCode,
  countryName,
}: {
  countryCode: string;
  countryName: string;
}) {
  const t = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function send() {
    const question = draft.trim();
    if (!question || busy) return;
    const conversation: Message[] = [...messages, { role: 'user', content: question }];
    setMessages([...conversation, { role: 'assistant', content: '' }]);
    setDraft('');
    setBusy(true);
    setError(null);
    let reply = '';
    try {
      const response = await streamText(
        '/api/tutor',
        { countryCode, messages: conversation },
        (piece) => {
          reply += piece;
          setMessages([...conversation, { role: 'assistant', content: reply }]);
        },
      );
      const left = response.headers.get('x-tutor-remaining');
      if (left !== null) setRemaining(Number(left));
    } catch (reason) {
      setMessages(conversation.slice(0, -1));
      setDraft(question);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="mt-8">
      <ol aria-live="polite" className="space-y-4">
        {messages.map((message, index) => (
          <li
            key={index}
            className={
              message.role === 'user'
                ? 'bg-primary-soft text-primary-fg ms-8 rounded-lg px-4 py-3'
                : 'bg-surface border-border me-8 rounded-lg border px-4 py-3'
            }
          >
            <span className="sr-only">
              {message.role === 'user' ? t('tutor.you') : t('tutor.tutor')}
            </span>
            {/* The tutor answers in the learner's study language, whatever the page's. */}
            <p dir="auto" className="whitespace-pre-line">
              {message.content || '…'}
            </p>
          </li>
        ))}
      </ol>
      {error && (
        <div className="mt-4">
          <Notice tone="error" role="alert">
            {error}
          </Notice>
        </div>
      )}
      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor="question" className="mb-1 block text-sm font-medium">
          {t('tutor.questionLabel', { country: countryName })}
        </label>
        <textarea
          ref={inputRef}
          id="question"
          rows={3}
          value={draft}
          maxLength={2000}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          dir="auto"
          className={fieldClass}
        />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy || !draft.trim()} className={buttonClass.primary}>
            {t('tutor.ask')}
          </button>
          <p className="text-fg-subtle text-sm">
            {t('tutor.keys')}
            {remaining !== null ? ` ${t('tutor.remaining', { count: remaining })}` : ''}
          </p>
        </div>
      </form>
    </div>
  );
}
