'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

import { buttonClass } from '@/components/ui';

// The interactive parts of the review queue: filters that apply as they are
// changed, and ticking several rows to decide them together. The filters are
// an ordinary form underneath and still work with JavaScript off; reviewing
// one at a time does too.

/**
 * The filter form. A change to a menu applies at once, and typing in the
 * search box applies when the typing pauses, without reloading the page.
 */
export function FilterForm({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const apply = () => {
    if (!form.current) return;
    const query = new URLSearchParams();
    for (const [name, value] of new FormData(form.current)) {
      if (typeof value === 'string' && value.trim()) query.set(name, value.trim());
    }
    router.replace(`/admin/content?${query}`, { scroll: false });
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  // The address is what is in force. When it changes by another route (a
  // filter's chip is removed, "Clear all", the back button), the menus and the
  // search box follow it; otherwise the next change would bring the old
  // filter back. The field being typed in is left alone.
  const params = useSearchParams();
  useEffect(() => {
    for (const control of form.current?.elements ?? []) {
      if (!(control instanceof HTMLSelectElement || control instanceof HTMLInputElement)) continue;
      if (!control.name || control.type === 'hidden' || control === document.activeElement)
        continue;
      const value = params.get(control.name) ?? '';
      if (control.value !== value) control.value = value;
    }
  }, [params]);

  return (
    <form
      ref={form}
      action="/admin/content"
      onSubmit={(event) => {
        event.preventDefault();
        clearTimeout(timer.current);
        apply();
      }}
      onChange={(event) => {
        clearTimeout(timer.current);
        const typing = (event.target as HTMLElement).tagName === 'INPUT';
        if (typing) timer.current = setTimeout(apply, 350);
        else apply();
      }}
    >
      {children}
    </form>
  );
}

/**
 * Wraps the list of a bulk form: counts what is ticked, offers "select all",
 * and shows the action bar (handed in as `bar`) once something is selected.
 * Give it a `key` that changes with the list, so a new list starts unticked.
 */
export function BulkSelection({
  total,
  noun,
  children,
  bar,
}: {
  total: number;
  /** What is being selected, for the count: "question", "translation". */
  noun: string;
  children: React.ReactNode;
  bar: React.ReactNode;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const all = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);

  const boxes = () => [
    ...(scope.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]') ?? []),
  ];
  const recount = () => setSelected(boxes().filter((box) => box.checked).length);

  useEffect(() => {
    if (all.current) all.current.indeterminate = selected > 0 && selected < total;
  }, [selected, total]);

  return (
    <div ref={scope} onChange={recount}>
      <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-t-lg border border-b-0 px-4 py-3 sm:px-5">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            ref={all}
            type="checkbox"
            className="accent-primary size-4"
            checked={total > 0 && selected === total}
            onChange={(event) => {
              for (const box of boxes()) box.checked = event.target.checked;
              recount();
            }}
          />
          Select all {total}
        </label>
        <p className="text-fg-muted text-sm" role="status">
          {selected === 0
            ? `Tick ${noun}s to act on several at once`
            : `${selected} ${noun}${selected === 1 ? '' : 's'} selected`}
        </p>
      </div>
      {children}
      {/* Appears once something is ticked, and stays in view while the list scrolls. */}
      <div
        hidden={selected === 0}
        className="border-border bg-surface-raised sticky bottom-4 z-10 mt-4 rounded-xl border p-4 shadow-lg"
        data-testid="bulk-bar"
      >
        {bar}
      </div>
    </div>
  );
}

/**
 * The bulk bar's "approve": it opens a dialog that says how many will go out
 * and asks the reviewer to confirm they checked each one, before anything is
 * sent. The server refuses an approval that did not come through here (it
 * checks the count the dialog confirmed).
 */
export function ConfirmApprove({
  label,
  noun,
  outcome,
  promise,
}: {
  /** The button that opens the dialog: "Approve and publish". */
  label: string;
  /** What is being approved: "question", "translation". */
  noun: string;
  /** What approving does to them: "published", "approved". */
  outcome: string;
  /** What the reviewer confirms: "I have checked each one against its source." */
  promise: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [selected, setSelected] = useState(0);
  const [unsourced, setUnsourced] = useState(0);
  const [checked, setChecked] = useState(false);
  const going = selected - unsourced;
  const plural = (count: number) => `${count} ${noun}${count === 1 ? '' : 's'}`;

  return (
    <>
      <button
        type="button"
        className={buttonClass.primary}
        onClick={(event) => {
          const ticked = [
            ...(event.currentTarget.form?.querySelectorAll<HTMLInputElement>(
              'input[name="ids"]:checked',
            ) ?? []),
          ];
          setSelected(ticked.length);
          setUnsourced(ticked.filter((box) => box.dataset.hasSource === 'false').length);
          setChecked(false);
          dialog.current?.showModal();
        }}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={title}
        // What was confirmed stands only while the dialog is open.
        onClose={() => setSelected(0)}
        className="bg-surface-raised text-fg border-border m-auto w-full max-w-md rounded-xl border p-6 shadow-lg backdrop:bg-black/50"
      >
        <h2 id={title} className="font-display text-xl font-semibold">
          {going > 0 ? `Approve ${plural(going)}?` : 'Nothing to approve'}
        </h2>
        <p className="mt-2 text-sm" data-testid="confirm-count">
          {going > 0
            ? `${plural(going)} will be ${outcome} and shown to learners as soon as you confirm.`
            : `None of the ${plural(selected)} you selected can be approved together.`}
        </p>
        {unsourced > 0 && (
          <p className="text-accent-fg mt-2 text-sm font-medium" data-testid="confirm-refused">
            {plural(unsourced)} {unsourced === 1 ? 'has' : 'have'} no source to check against and
            will not be approved here. Open {unsourced === 1 ? 'it' : 'each'} and review it on its
            own.
          </p>
        )}
        {going > 0 && (
          <label className="mt-4 flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="checked"
              className="accent-primary mt-0.5 size-4"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>{promise}</span>
          </label>
        )}
        {/* What the reviewer was shown, for the server to hold the approval to. */}
        <input type="hidden" name="confirmed" value={selected} />
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            className={buttonClass.secondary}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          {going > 0 && (
            <button
              type="submit"
              name="decision"
              value="approve"
              disabled={!checked}
              className={`${buttonClass.primary} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Approve {plural(going)}
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
