'use client';

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

import { buttonClass } from '@/components/ui';

/**
 * A form's submit button that sends it once: while the form is being sent, a
 * second click (or Enter) does nothing, so a slow answer cannot become two
 * posts. Not `disabled` while sending: a screen reader would meet a dead
 * button and no reason. It is marked busy, and says what is happening.
 *
 * The form's own submit event is the guard, not the pending state alone: a
 * fast double click lands before React has drawn the pending state. Only a
 * submit that passed the form's checks counts, so an empty field never leaves
 * the button stuck.
 */
export function SendButton({ label, sending }: { label: string; sending: string }) {
  const { pending } = useFormStatus();
  const button = useRef<HTMLButtonElement>(null);
  const sent = useRef(false);

  useEffect(() => {
    const form = button.current?.form;
    if (!form) return;
    const once = (event: SubmitEvent) => {
      if (sent.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      sent.current = true;
    };
    // Capturing, so it runs before React sends the form.
    form.addEventListener('submit', once, true);
    return () => form.removeEventListener('submit', once, true);
  }, []);

  // Sent and answered (an error shown, say): it can be sent again.
  useEffect(() => {
    if (!pending) sent.current = false;
  }, [pending]);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        ref={button}
        type="submit"
        aria-disabled={pending || undefined}
        aria-busy={pending || undefined}
        className={`${buttonClass.primary} ${pending ? 'cursor-wait opacity-70' : ''}`}
      >
        {label}
      </button>
      <p role="status" className="text-fg-muted text-sm">
        {pending ? sending : ''}
      </p>
    </div>
  );
}
