import { MicBlockedError, type AudioPlatform } from '@oathly/api/audio';
import { speechLocale } from '@oathly/i18n';
import * as Speech from 'expo-speech';

import { playClip } from './audio-player';
import { audioStore } from './audio-store';
import { api } from './auth';
import { isOnline } from './offline';

// Audio mode on the phone. A question is read from its recorded clip: the
// copy saved with a downloaded pack if there is one, otherwise the server's
// while there is a connection. With neither, the phone's own voice reads the
// words, so audio mode never needs a connection to work.

/** Reads text in the phone's own voice for that language. */
function readAloud(text: string, locale: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      signal.removeEventListener('abort', stop);
      resolve();
    };
    const stop = () => {
      void Speech.stop();
      finish();
    };
    signal.addEventListener('abort', stop);
    Speech.speak(text, {
      language: speechLocale(locale),
      onDone: finish,
      onStopped: finish,
      onError: finish,
    });
  });
}

type Recognition = typeof import('expo-speech-recognition');

/**
 * The speech recogniser, where the app was built with it. Expo Go has no
 * such module, so it is loaded with care and its absence only means answers
 * are tapped.
 */
function loadRecognition(): Recognition['ExpoSpeechRecognitionModule'] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition') as Recognition;
    return ExpoSpeechRecognitionModule.isRecognitionAvailable()
      ? ExpoSpeechRecognitionModule
      : null;
  } catch {
    return null;
  }
}

const recogniser = loadRecognition();

async function listen(
  module: NonNullable<typeof recogniser>,
  locale: string,
  signal: AbortSignal,
): Promise<string[]> {
  const permission = await module.requestPermissionsAsync();
  if (!permission.granted) throw new MicBlockedError('The microphone is not allowed.');
  if (signal.aborted) return [];
  return new Promise((resolve, reject) => {
    let heard: string[] = [];
    let blocked = false;
    const stop = () => module.abort();
    const listeners = [
      module.addListener('result', (event) => {
        if (event.isFinal) heard = event.results.map((reading) => reading.transcript);
      }),
      module.addListener('error', (event) => {
        blocked = event.error === 'not-allowed' || event.error === 'service-not-allowed';
        // Anything else ("no-speech", "network") ends as nothing heard.
      }),
      module.addListener('end', () => {
        signal.removeEventListener('abort', stop);
        for (const listener of listeners) listener.remove();
        if (blocked) reject(new MicBlockedError('The microphone is not allowed.'));
        else resolve(heard);
      }),
    ];
    signal.addEventListener('abort', stop);
    module.start({
      lang: speechLocale(locale),
      interimResults: false,
      maxAlternatives: 3,
      // With no connection, only the phone's own recogniser can help.
      requiresOnDeviceRecognition: !isOnline(),
    });
  });
}

export const audioPlatform: AudioPlatform = {
  async speak(item, signal) {
    if (item.clipId) {
      const uri =
        (await audioStore.uri(item.clipId)) ?? (isOnline() ? api.audioUrl(item.clipId) : null);
      if (uri && ((await playClip(uri, signal)) || signal.aborted)) return;
    }
    await readAloud(item.text, item.locale, signal);
  },
  listen: recogniser ? (locale, signal) => listen(recogniser, locale, signal) : undefined,
};
