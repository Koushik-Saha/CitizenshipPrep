'use client';

import { useEffect, useState } from 'react';

import { flushAnswers, subscribePending } from '@/lib/answer-sync';

// Whether a session in this tab has changed what the dashboard shows since it
// was last fetched. The dashboard cannot tell from its own data: coming back
// with the browser's Back button, Next shows the page as it was rendered before
// the session, numbers and all. So a session says so here, and the dashboard
// fetches itself again before showing any numbers. A full page load starts
// afresh, with the server's current dashboard.

let changed = false;

/** Called by a session when it starts and when it ends. */
export function markDashboardChanged(): void {
  changed = true;
}

/** How long to wait for answers still on this device (offline, say) before fetching anyway. */
const SEND_WAIT_MS = 4_000;

/**
 * True while the dashboard is out of date because of a session: until this
 * tab's answers have been sent and the dashboard fetched again.
 */
export function useOutdatedDashboard(refetch: () => Promise<unknown>): boolean {
  const [outdated, setOutdated] = useState(() => changed);
  useEffect(() => {
    if (!outdated) return;
    let live = true;
    let fetching = false;
    const fetchNow = () => {
      if (fetching) return;
      fetching = true;
      void refetch().finally(() => {
        changed = false;
        if (live) setOutdated(false);
      });
    };
    // The last answers may still be waiting to go: send them, and fetch once they have.
    flushAnswers();
    const unsubscribe = subscribePending((pending) => {
      if (pending === 0) fetchNow();
    });
    const timer = setTimeout(fetchNow, SEND_WAIT_MS);
    return () => {
      live = false;
      unsubscribe();
      clearTimeout(timer);
    };
  }, [outdated, refetch]);
  return outdated;
}
