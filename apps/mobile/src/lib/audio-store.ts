import { Directory, File, Paths } from 'expo-file-system';

// Recorded clips saved on the phone, so audio mode works with no connection.
// One file per clip, named by the clip's id. (The browser build keeps them in
// the browser's cache instead: see audio-store.web.ts.)

/** The file ending for each kind of audio the server sends: players go by it. */
const endings: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
};

function folder(): Directory {
  const directory = new Directory(Paths.document, 'oathly', 'audio');
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function find(clipId: string): File | null {
  for (const ending of Object.values(endings)) {
    const file = new File(folder(), `${clipId}.${ending}`);
    if (file.exists) return file;
  }
  return null;
}

export const audioStore = {
  /** Saves a clip from `url`. False if it could not be fetched or stored. */
  async save(clipId: string, url: string): Promise<boolean> {
    try {
      if (find(clipId)) return true;
      const response = await fetch(url);
      if (!response.ok) return false;
      const kind = (response.headers.get('content-type') ?? '').split(';')[0]!.trim();
      const file = new File(folder(), `${clipId}.${endings[kind] ?? 'mp3'}`);
      file.create({ overwrite: true });
      file.write(new Uint8Array(await response.arrayBuffer()));
      return true;
    } catch {
      return false;
    }
  },

  /** Where a saved clip can be played from, or null if it is not on the phone. */
  uri(clipId: string): Promise<string | null> {
    try {
      return Promise.resolve(find(clipId)?.uri ?? null);
    } catch {
      return Promise.resolve(null);
    }
  },

  async remove(clipIds: readonly string[]): Promise<void> {
    for (const clipId of clipIds) {
      try {
        find(clipId)?.delete();
      } catch {
        // Already gone.
      }
    }
  },
};
