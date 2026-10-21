'use client';

import { useEffect } from 'react';

import { USAGE_OFF_KEY } from '@/lib/usage';

/**
 * Remembers on this device whether its learner has asked not to be counted
 * (the switch on their account page), so that the next page they open does
 * not load usage recording. Renders nothing.
 */
export function UsageChoice({ off }: { off: boolean }) {
  useEffect(() => {
    try {
      if (off) localStorage.setItem(USAGE_OFF_KEY, '1');
      else localStorage.removeItem(USAGE_OFF_KEY);
    } catch {
      // Storage blocked: nothing to remember it in, and nothing loads from it either.
    }
  }, [off]);
  return null;
}
