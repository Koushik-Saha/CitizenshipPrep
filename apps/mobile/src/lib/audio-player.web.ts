// Playing one recorded clip in the browser build, through an <audio>
// element. Same interface as audio-player.ts.

/** Plays a clip to its end. False if it could not be played. */
export function playClip(uri: string, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(uri);
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
    // Refused (no tap on the page yet), stopped before it began, or not decodable.
    audio.play().catch(() => finish(false));
  });
}
