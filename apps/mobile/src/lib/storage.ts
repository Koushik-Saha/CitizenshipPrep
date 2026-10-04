import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

// Where the app keeps things between launches. Small values (the answer
// queue, settings) go in key-value storage; country packs can run to a few
// megabytes, past what key-value storage is good for on Android, so they are
// files. The browser build has no file system and keeps both in localStorage.

/** Small values. Failures are swallowed: the app carries on from memory. */
export const kv = {
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Storage full or unavailable.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Nothing to remove.
    }
  },
};

const onWeb = Platform.OS === 'web';
const FOLDER = 'oathly';

function fileFor(name: string): File {
  const folder = new Directory(Paths.document, FOLDER);
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  return new File(folder, name);
}

/** Larger documents, by name. Reads return null when missing or unreadable. */
export const files = {
  async read(name: string): Promise<string | null> {
    if (onWeb) return kv.get(`file:${name}`);
    try {
      const file = fileFor(name);
      return file.exists ? await file.text() : null;
    } catch {
      return null;
    }
  },
  /** Throws if the document cannot be saved: the caller decides what to tell the learner. */
  async write(name: string, text: string): Promise<void> {
    if (onWeb) {
      await AsyncStorage.setItem(`file:${name}`, text);
      return;
    }
    const file = fileFor(name);
    if (!file.exists) file.create({ overwrite: true });
    file.write(text);
  },
  async remove(name: string): Promise<void> {
    if (onWeb) return kv.remove(`file:${name}`);
    try {
      const file = fileFor(name);
      if (file.exists) file.delete();
    } catch {
      // Already gone.
    }
  },
};
