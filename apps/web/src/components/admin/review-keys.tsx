'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

// Keys for reviewing without the mouse, and the count of what has been
// approved today. Single-letter keys can be switched off (they get in the way
// of speech input and some assistive software), and never fire while typing.

const STORAGE_KEY = 'oathly.review-keys';

const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  target.closest('input, textarea, select, [contenteditable="true"]') !== null;

/** Presses the control marked for a shortcut, if the page has it. */
function press(name: string): boolean {
  const control = document.querySelector<HTMLElement>(`[data-shortcut="${name}"]`);
  if (!control || (control instanceof HTMLButtonElement && control.disabled)) return false;
  control.click();
  return true;
}

const kbd = 'border-border-strong bg-surface rounded-xs border px-1.5 py-0.5 font-mono text-xs';

export function ReviewKeys({ canDecide }: { canDecide: boolean }) {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    // Read once the page is in the browser: the server cannot know.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.localStorage.getItem(STORAGE_KEY) === 'off') setEnabled(false);
  }, []);

  // The cited words, brought into view inside the passage's own scroll box.
  useEffect(() => {
    const cited = document.getElementById('cited');
    const box = cited?.closest<HTMLElement>('[data-passage]');
    if (cited && box) box.scrollTop = Math.max(0, cited.offsetTop - box.offsetTop - 96);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Ctrl or Command with Enter sends the reason being typed.
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        const form = event.target instanceof HTMLTextAreaElement ? event.target.form : null;
        if (form?.dataset.decision) {
          event.preventDefault();
          form.requestSubmit();
        }
        return;
      }
      if (!enabled || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey || typingIn(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'r') {
        const reason = document.querySelector<HTMLTextAreaElement>(
          'form[data-decision="reject"] textarea',
        );
        if (!reason) return;
        event.preventDefault();
        reason.focus();
        reason.scrollIntoView({ block: 'center' });
        return;
      }
      const name = { a: 'approve', s: 'save', j: 'next', k: 'previous' }[key];
      if (name && press(name)) event.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);

  return (
    <div className="text-fg-muted flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={enabled}
          onChange={(event) => {
            setEnabled(event.target.checked);
            window.localStorage.setItem(STORAGE_KEY, event.target.checked ? 'on' : 'off');
          }}
        />
        Keyboard shortcuts
      </label>
      {enabled && (
        <p data-testid="shortcut-keys">
          {canDecide && (
            <>
              <kbd className={kbd}>A</kbd> approve, <kbd className={kbd}>R</kbd> reject (type the
              reason, then <kbd className={kbd}>Ctrl</kbd> + <kbd className={kbd}>Enter</kbd>),{' '}
            </>
          )}
          <kbd className={kbd}>S</kbd> save, <kbd className={kbd}>J</kbd> next,{' '}
          <kbd className={kbd}>K</kbd> previous
        </p>
      )}
    </div>
  );
}

const never = () => () => {};

/**
 * How many questions were approved today, from the times the server knows
 * of. "Today" is the reviewer's own calendar day, which only their browser
 * can say, so the number appears once the page is in it.
 */
export function ApprovedToday({ times }: { times: readonly string[] }) {
  const count = useSyncExternalStore(
    never,
    () => {
      const today = new Date().toDateString();
      return times.filter((time) => new Date(time).toDateString() === today).length;
    },
    () => null,
  );
  return (
    <p
      className="bg-primary-soft text-primary-fg rounded-full px-4 py-1.5 text-sm font-medium"
      data-testid="approved-today"
    >
      {count === null ? 'Approved today' : `${count} approved today`}
    </p>
  );
}
