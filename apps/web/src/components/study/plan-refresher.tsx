'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * After a purchase, the payment provider tells the server a moment later
 * than it sends the learner back. This asks the page again a few times until
 * the new plan is there, so nobody has to reload to see what they bought.
 */
export function PlanRefresher({ times = 8, everyMs = 2500 }: { times?: number; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let left = times;
    const timer = setInterval(() => {
      router.refresh();
      left -= 1;
      if (left <= 0) clearInterval(timer);
    }, everyMs);
    return () => clearInterval(timer);
  }, [everyMs, router, times]);
  return null;
}
