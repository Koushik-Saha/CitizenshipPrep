// The browser build's clip store: the browser's Cache Storage, which holds
// whole responses and survives going offline. Same interface as audio-store.ts.

const CACHE = 'oathly-audio-v1';
const key = (clipId: string) => `/oathly-audio/${clipId}`;
/** Addresses made for saved clips this visit, so each is made once. */
const playable = new Map<string, string>();

export const audioStore = {
  /** Saves a clip from `url`. False if it could not be fetched or stored. */
  async save(clipId: string, url: string): Promise<boolean> {
    try {
      const cache = await caches.open(CACHE);
      if (await cache.match(key(clipId))) return true;
      const response = await fetch(url);
      if (!response.ok) return false;
      await cache.put(key(clipId), response);
      return true;
    } catch {
      return false;
    }
  },

  /** Where a saved clip can be played from, or null if it is not saved. */
  async uri(clipId: string): Promise<string | null> {
    const made = playable.get(clipId);
    if (made) return made;
    try {
      const saved = await (await caches.open(CACHE)).match(key(clipId));
      if (!saved) return null;
      const address = URL.createObjectURL(await saved.blob());
      playable.set(clipId, address);
      return address;
    } catch {
      return null;
    }
  },

  async remove(clipIds: readonly string[]): Promise<void> {
    try {
      const cache = await caches.open(CACHE);
      for (const clipId of clipIds) {
        await cache.delete(key(clipId));
        const address = playable.get(clipId);
        if (address) URL.revokeObjectURL(address);
        playable.delete(clipId);
      }
    } catch {
      // No cache to clear.
    }
  },
};
