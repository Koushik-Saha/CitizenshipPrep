'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Milliseconds left until `deadline` (null when there is no time limit),
 * ticking once a second while `running`. Calls `onExpire` once at zero.
 */
export function useCountdown(
  deadline: number | null,
  running: boolean,
  onExpire: () => void,
): number | null {
  const [now, setNow] = useState(() => Date.now());
  const expired = useRef(false);
  const expire = useRef(onExpire);

  useEffect(() => {
    expire.current = onExpire;
  });

  useEffect(() => {
    if (deadline === null || !running) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline && !expired.current) {
        expired.current = true;
        expire.current();
      }
    };
    const timer = setInterval(tick, 1_000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [deadline, running]);

  return deadline === null ? null : Math.max(0, deadline - now);
}
