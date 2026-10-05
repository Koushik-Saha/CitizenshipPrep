import { MicBlockedError, type AudioPlatform } from '@oathly/api/audio';
import { audioClipUrl } from '@oathly/api/study';
import { speechLocale } from '@oathly/i18n';
import { useSyncExternalStore } from 'react';

// Audio mode in the browser: recorded clips through an <audio> element, the
// browser's own voice (speechSynthesis) where no clip exists, and its speech
// recognition for spoken answers, where it has any (Chrome, Edge, Safari).

/** Plays a clip to its end. False if it could not be played. */
function playClip(url: string, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    const finish = (played: boolean) => {
      signal.removeEventListener('abort', stop);
      resolve(played);
    };
    const stop = () => {
      audio.pause();
      finish(true);
    };
    signal.addEventListener('abort', stop);
    audio.addEventListener('ended', () => finish(true));
    audio.addEventListener('error', () => finish(false));
    // Refused (no click on the page yet) or not decodable.
    audio.play().catch(() => finish(false));
  });
}

/** Reads text in the browser's voice for that language, if it has one. */
function readAloud(text: string, locale: string, signal: AbortSignal): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.resolve();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLocale(locale);
    const finish = () => {
      signal.removeEventListener('abort', stop);
      resolve();
    };
    const stop = () => {
      window.speechSynthesis.cancel();
      finish();
    };
    signal.addEventListener('abort', stop);
    utterance.addEventListener('end', finish);
    utterance.addEventListener('error', finish);
    window.speechSynthesis.speak(utterance);
  });
}

// The Web Speech API's recognition half, which TypeScript's DOM types leave out.
interface Recogniser extends EventTarget {
  lang: string;
  maxAlternatives: number;
  interimResults: boolean;
  start(): void;
  abort(): void;
}
interface RecogniserResult extends Event {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
type RecogniserClass = new () => Recogniser;

function recogniserClass(): RecogniserClass | undefined {
  const scope = window as unknown as {
    SpeechRecognition?: RecogniserClass;
    webkitSpeechRecognition?: RecogniserClass;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

function listen(Recognition: RecogniserClass, locale: string, signal: AbortSignal) {
  return new Promise<string[]>((resolve, reject) => {
    const recogniser = new Recognition();
    recogniser.lang = speechLocale(locale);
    recogniser.maxAlternatives = 3;
    recogniser.interimResults = false;
    let heard: string[] = [];
    const stop = () => recogniser.abort();
    signal.addEventListener('abort', stop);
    recogniser.addEventListener('result', (event) => {
      const [first] = Array.from((event as RecogniserResult).results);
      heard = first ? Array.from(first, (reading) => reading.transcript) : [];
    });
    recogniser.addEventListener('error', (event) => {
      const reason = (event as Event & { error?: string }).error;
      if (reason === 'not-allowed' || reason === 'service-not-allowed') {
        reject(new MicBlockedError('The microphone is not allowed.'));
      }
      // Anything else ("no-speech", "network") ends as nothing heard.
    });
    recogniser.addEventListener('end', () => {
      signal.removeEventListener('abort', stop);
      resolve(heard);
    });
    try {
      recogniser.start();
    } catch {
      resolve([]);
    }
  });
}

function createPlatform(): AudioPlatform {
  const Recognition = recogniserClass();
  return {
    async speak(item, signal) {
      if (item.clipId) {
        const played = await playClip(audioClipUrl(window.location.origin, item.clipId), signal);
        if (played || signal.aborted) return;
      }
      await readAloud(item.text, item.locale, signal);
    },
    listen: Recognition ? (locale, signal) => listen(Recognition, locale, signal) : undefined,
  };
}

/** On the server there is nothing to play with; the page comes alive in the browser. */
const silent: AudioPlatform = { speak: () => Promise.resolve() };
let browser: AudioPlatform | undefined;
const never = () => () => {};

/** The browser's audio, the same object for the life of the page. */
export function useAudioPlatform(): AudioPlatform {
  return useSyncExternalStore(
    never,
    () => (browser ??= createPlatform()),
    () => silent,
  );
}
