'use server';

import { newCommentSchema, newPostSchema, reportSchema } from '@oathly/api/community';
import {
  CommunityError,
  createComment,
  createPost,
  reportContent,
  toggleVote,
} from '@oathly/api/server';
import type { RateLimitName } from '@oathly/core';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getScreener, isCommunitySwitchedOff } from '@/lib/community';
import { getDb } from '@/lib/db';
import { localizedPath } from '@/lib/i18n';
import { addressOf, rateLimited } from '@/lib/rate-limit';
import { currentUser } from '@/lib/user';

// Everything a learner does in a study group goes through here: signed in,
// rate limited, checked against the same shapes as the API, and (for writing)
// screened before anyone else can read it.

const text = (form: FormData, name: string) => String(form.get(name) ?? '');
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signedIn(limit: RateLimitName, back: string): Promise<string> {
  if (isCommunitySwitchedOff()) redirect(await localizedPath('/study'));
  const user = await currentUser();
  if (!user) redirect(await localizedPath('/sign-in'));
  if (await rateLimited(limit, 'user', user.userId))
    redirect(await localizedPath(`${back}notice=wait`));
  // Writing is screened by the model, which costs something each time: it is
  // also limited by where it comes from, and refused if that cannot be counted.
  if (limit === 'communityPost' || limit === 'communityComment') {
    const request = new Request('http://community.invalid', { headers: await headers() });
    if (
      await rateLimited('communityByAddress', 'address', addressOf(request), { failClosed: true })
    ) {
      redirect(await localizedPath(`${back}notice=wait`));
    }
  }
  return user.userId;
}

/** Where to go after writing: back with what happened to it. */
const outcome = (posted: { heldFor: readonly string[]; legalNotice: boolean }) =>
  posted.legalNotice ? 'legal' : posted.heldFor.length > 0 ? 'held' : 'posted';

export async function submitPost(form: FormData): Promise<void> {
  const country = text(form, 'countryCode');
  const back = `/study/community?country=${/^[A-Z]{2}$/.test(country) ? country : ''}&`;
  const userId = await signedIn('communityPost', back);
  const parsed = newPostSchema.safeParse({
    countryCode: country,
    kind: text(form, 'kind'),
    title: text(form, 'title'),
    body: text(form, 'body'),
    examDate:
      text(form, 'kind') === 'story' && text(form, 'examDate') ? text(form, 'examDate') : null,
  });
  if (!parsed.success) redirect(await localizedPath(`${back}notice=invalid`));
  let target: string;
  try {
    const posted = await createPost(getDb(), getScreener(), userId, parsed.data);
    target = `/study/community/${posted.id}?notice=${outcome(posted)}`;
  } catch (error) {
    if (!(error instanceof CommunityError)) throw error;
    target = `${back}notice=invalid`;
  }
  redirect(await localizedPath(target));
}

export async function submitComment(postId: string, form: FormData): Promise<void> {
  if (!ID.test(postId)) redirect(await localizedPath('/study/community'));
  const back = `/study/community/${postId}?`;
  const userId = await signedIn('communityComment', back);
  const parsed = newCommentSchema.safeParse({ body: text(form, 'body') });
  if (!parsed.success) redirect(await localizedPath(`${back}notice=invalid`));
  let notice: string;
  try {
    notice = outcome(await createComment(getDb(), getScreener(), userId, postId, parsed.data.body));
  } catch (error) {
    if (!(error instanceof CommunityError)) throw error;
    notice = 'invalid';
  }
  redirect(await localizedPath(`${back}notice=${notice}#comments`));
}

export async function vote(postId: string): Promise<void> {
  if (!ID.test(postId)) redirect(await localizedPath('/study/community'));
  const back = `/study/community/${postId}?`;
  const userId = await signedIn('communityVote', back);
  try {
    await toggleVote(getDb(), userId, postId);
  } catch (error) {
    if (!(error instanceof CommunityError)) throw error;
  }
  redirect(await localizedPath(`/study/community/${postId}`));
}

export async function report(
  postId: string,
  commentId: string | null,
  form: FormData,
): Promise<void> {
  if (!ID.test(postId) || (commentId !== null && !ID.test(commentId))) {
    redirect(await localizedPath('/study/community'));
  }
  const back = `/study/community/${postId}?`;
  const userId = await signedIn('communityReport', back);
  const parsed = reportSchema.safeParse({
    reason: text(form, 'reason'),
    details: text(form, 'details').trim() || null,
  });
  if (!parsed.success) redirect(await localizedPath(`${back}notice=invalid`));
  let target = `${back}notice=reported`;
  try {
    const { hidden } = await reportContent(
      getDb(),
      userId,
      commentId ? { commentId } : { postId },
      parsed.data,
    );
    // The post itself is now hidden from this learner too: back to the group.
    if (hidden && !commentId) target = '/study/community?notice=reported';
  } catch (error) {
    if (!(error instanceof CommunityError)) throw error;
    target = `${back}notice=invalid`;
  }
  redirect(await localizedPath(target));
}
