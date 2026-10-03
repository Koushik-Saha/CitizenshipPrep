'use client';

import { useRef, useState } from 'react';

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
                ? 'bg-primary-soft text-primary-fg ml-8 rounded-lg px-4 py-3'
                : 'bg-surface border-border mr-8 rounded-lg border px-4 py-3'
            }
          >
            <span className="sr-only">{message.role === 'user' ? 'You:' : 'Tutor:'}</span>
            <p className="whitespace-pre-line">{message.content || '…'}</p>
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
          Your question about the {countryName} test
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
          className={fieldClass}
        />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy || !draft.trim()} className={buttonClass.primary}>
            Ask
          </button>
          <p className="text-fg-subtle text-sm">
            Enter to send, Shift+Enter for a new line.
            {remaining !== null ? ` ${remaining} questions left today.` : ''}
          </p>
        </div>
      </form>
    </div>
  );
}
