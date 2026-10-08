import { ensureReviewer, type Reviewer } from '@oathly/content/review';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ADMIN_SESSION_COOKIE, verifyAdminCookie } from './admin-credentials';
import { getDb } from './db';

export { getDb };

const globalForReviewers = globalThis as typeof globalThis & { oathlyReviewers?: Set<string> };

/**
 * The reviewer making this request, or a redirect to sign in. The proxy has
 * already checked the session; this checks it again so that no page or Server
 * Action relies on the proxy alone.
 */
export async function requireReviewer(): Promise<Reviewer> {
  const username = verifyAdminCookie((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if (!username) redirect('/admin/sign-in');

  const reviewer: Reviewer = { id: `admin:${username}`, displayName: username };
  globalForReviewers.oathlyReviewers ??= new Set();
  if (!globalForReviewers.oathlyReviewers.has(reviewer.id)) {
    await ensureReviewer(getDb(), reviewer, 'admin');
    globalForReviewers.oathlyReviewers.add(reviewer.id);
  }
  return reviewer;
}
