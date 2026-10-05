import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

// Playing one recorded clip on the phone. (The browser build plays through
// an <audio> element instead: see audio-player.web.ts.)

let prepared = false;
/** Lets audio play with the ring switch on silent: someone who turned audio mode on wants to hear it. */
async function prepare(): Promise<void> {
  if (prepared) return;
  prepared = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    // Not fatal: it plays whenever the phone is not on silent.
  }
}

/** How long a clip may take to start before it is given up on. */
const START_MS = 8_000;

/** Plays a clip to its end. False if it could not be played. */
export async function playClip(uri: string, signal: AbortSignal): Promise<boolean> {
  await prepare();
  return new Promise((resolve) => {
    let player: ReturnType<typeof createAudioPlayer>;
    try {
      player = createAudioPlayer(uri);
    } catch {
      resolve(false);
      return;
    }
    let started = false;
    let settled = false;
    const finish = (played: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      signal.removeEventListener('abort', stop);
      updates.remove();
      try {
        player.remove();
      } catch {
        // Already released.
      }
      resolve(played);
    };
    const stop = () => {
      try {
        player.pause();
      } catch {
        // Nothing playing.
      }
      finish(true);
    };
    const updates = player.addListener('playbackStatusUpdate', (status) => {
      if (status.playing) started = true;
      if (status.didJustFinish) finish(true);
    });
    // A clip that never starts (a bad file, a dropped connection) must not stall the session.
    const guard = setTimeout(() => {
      if (!started) finish(false);
    }, START_MS);
    signal.addEventListener('abort', stop);
    player.play();
  });
}
