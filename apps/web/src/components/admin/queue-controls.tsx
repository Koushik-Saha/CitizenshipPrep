'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
