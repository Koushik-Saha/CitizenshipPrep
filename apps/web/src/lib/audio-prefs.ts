import { useSyncExternalStore } from 'react';

// Whether this learner studies with audio mode, kept in the browser so the
// choice is still there next session.

export interface AudioPrefs {
  /** Read questions aloud. */
  audio: boolean;
  /** Listen for spoken answers. */
  voice: boolean;
}

const KEY = 'oathly.audio';
const defaults: AudioPrefs = { audio: false, voice: true };
const listeners = new Set<() => void>();
let current: AudioPrefs | undefined;

function read(): AudioPrefs {
  if (current) return current;
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Partial<AudioPrefs>;
    current = { audio: saved.audio === true, voice: saved.voice !== false };
  } catch {
    // Storage is blocked or holds something else: carry on with the defaults.
    current = defaults;
  }
  return current;
}

export function setAudioPrefs(change: Partial<AudioPrefs>): void {
  current = { ...read(), ...change };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not saved; it still holds for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAudioPrefs(): AudioPrefs {
  return useSyncExternalStore(subscribe, read, () => defaults);
}
