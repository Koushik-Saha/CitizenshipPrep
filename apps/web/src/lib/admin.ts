import { createPool } from '@oathly/content/db';
import { ensureReviewer, type Reviewer } from '@oathly/content/review';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { verifyBasicAuth } from './admin-credentials';

type Pool = ReturnType<typeof createPool>;

// One pool per server process, surviving hot reloads in development.
const globalForDb = globalThis as typeof globalThis & {
  oathlyPool?: Pool;
  oathlyReviewers?: Set<string>;
};

export function getDb(): Pool {
  globalForDb.oathlyPool ??= createPool();
  return globalForDb.oathlyPool;
}

/**
 * The reviewer making this request. The proxy has already challenged for
 * credentials; this checks them again so that no page or Server Action relies
 * on the proxy alone.
 */
export async function requireReviewer(): Promise<Reviewer> {
  const username = verifyBasicAuth((await headers()).get('authorization'));
  if (!username) notFound();

  const reviewer: Reviewer = { id: `admin:${username}`, displayName: username };
  globalForDb.oathlyReviewers ??= new Set();
  if (!globalForDb.oathlyReviewers.has(reviewer.id)) {
    await ensureReviewer(getDb(), reviewer, 'admin');
    globalForDb.oathlyReviewers.add(reviewer.id);
  }
  return reviewer;
}
