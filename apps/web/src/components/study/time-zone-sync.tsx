'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Tells the server the learner's time zone once, so streaks follow their days. */
export function TimeZoneSync({ current }: { current: string }) {
  const router = useRouter();
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone || zone === current) return;
    void fetch('/api/me/time-zone', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ timeZone: zone }),
    }).then((response) => {
      if (response.ok) router.refresh();
    });
  }, [current, router]);
  return null;
}
