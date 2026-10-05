import { useSyncExternalStore } from 'react';

import { kv } from './storage';

// Whether this learner studies with audio mode, kept on the phone so the
// choice is still there next time.

export interface AudioPrefs {
  /** Read questions aloud. */
  audio: boolean;
  /** Listen for spoken answers. */
  voice: boolean;
}

const KEY = 'oathly.audio';
let current: AudioPrefs = { audio: false, voice: true };
const listeners = new Set<() => void>();

void kv.get(KEY).then((stored) => {
  if (!stored) return;
  try {
    const saved = JSON.parse(stored) as Partial<AudioPrefs>;
    current = { audio: saved.audio === true, voice: saved.voice !== false };
    for (const listener of listeners) listener();
  } catch {
    // Something else was stored there: keep the defaults.
  }
});

export function setAudioPrefs(change: Partial<AudioPrefs>): void {
  current = { ...current, ...change };
  void kv.set(KEY, JSON.stringify(current));
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAudioPrefs(): AudioPrefs {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}
