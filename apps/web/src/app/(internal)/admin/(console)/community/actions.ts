'use server';

import { CommunityError, moderate } from '@oathly/api/server';
import { redirect } from 'next/navigation';

import { requireReviewer } from '@/lib/admin';
import { getDb } from '@/lib/db';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A moderator's decision on one post or comment in the queue. */
export async function decide(form: FormData): Promise<void> {
  const reviewer = await requireReviewer();
  const target = form.get('target');
  const id = String(form.get('id') ?? '');
  const decision = form.get('decision');
  if (
    (target !== 'post' && target !== 'comment') ||
    (decision !== 'approve' && decision !== 'remove') ||
    !ID.test(id)
  ) {
    redirect('/admin/community?problem=invalid');
  }
  try {
    await moderate(getDb(), reviewer, target, id, decision);
  } catch (error) {
    if (!(error instanceof CommunityError)) throw error;
    redirect('/admin/community?problem=gone');
  }
  redirect(`/admin/community?done=${decision}`);
}
