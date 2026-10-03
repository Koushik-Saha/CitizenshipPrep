import { ensureReviewer, type Reviewer } from '@oathly/content/review';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { verifyBasicAuth } from './admin-credentials';
import { getDb } from './db';

export { getDb };

const globalForReviewers = globalThis as typeof globalThis & { oathlyReviewers?: Set<string> };

/**
 * The reviewer making this request. The proxy has already challenged for
 * credentials; this checks them again so that no page or Server Action relies
 * on the proxy alone.
 */
export async function requireReviewer(): Promise<Reviewer> {
  const username = verifyBasicAuth((await headers()).get('authorization'));
  if (!username) notFound();

  const reviewer: Reviewer = { id: `admin:${username}`, displayName: username };
  globalForReviewers.oathlyReviewers ??= new Set();
  if (!globalForReviewers.oathlyReviewers.has(reviewer.id)) {
    await ensureReviewer(getDb(), reviewer, 'admin');
    globalForReviewers.oathlyReviewers.add(reviewer.id);
  }
  return reviewer;
}
