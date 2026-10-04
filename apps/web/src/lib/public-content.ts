import type { createPool } from '@oathly/content/db';

import { getDb } from '@/lib/db';

type Pool = ReturnType<typeof createPool>;

/**
 * Reads public content for a statically built page. A build without a
 * database (CI, a preview) still produces the page, with `fallback`; the
 * next revalidation fills it in. At request time errors are thrown as usual.
 */
export async function loadPublic<T>(read: (db: Pool) => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read(getDb());
  } catch (error) {
    if (process.env.NEXT_PHASE !== 'phase-production-build') throw error;
    console.warn('Public page built without its data; it fills in on revalidation.', error);
    return fallback;
  }
}
