'use server';

import { closeFlag, closeFlagsOnQuestion, questionOfOpenFlag } from '@oathly/content/flags';
import { retireQuestion, ReviewError } from '@oathly/content/review';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { audit, getDb, requireReviewer } from '@/lib/admin';
import { revalidatePublicContent } from '@/lib/revalidate';

const decisions = ['fixed', 'withdraw', 'dismiss'] as const;
type Decision = (typeof decisions)[number];

/**
 * A reviewer's decision on one learner's report:
 * - fixed: the question has been corrected (or will not be shown as it was);
 * - withdraw: the question is taken away from learners until it is put
 *   right, which answers every open report on it;
 * - dismiss: there was nothing to fix.
 */
export async function decideFlag(form: FormData): Promise<void> {
  const reviewer = await requireReviewer();
  const id = String(form.get('id') ?? '');
  const decision = decisions.find((candidate) => candidate === form.get('decision')) as
    Decision | undefined;
  const note = String(form.get('note') ?? '').trim();
  const back = (query: string) => redirect(`/admin/flags?${query}`);
  if (!decision) back('problem=invalid');

  try {
    if (decision === 'withdraw') {
      const questionId = await questionOfOpenFlag(getDb(), id);
      if (!questionId) throw new ReviewError('That report has already been closed.');
      const why = note || 'Withdrawn after a learner reported a problem with it.';
      await retireQuestion(getDb(), questionId, reviewer.id, why);
      const closed = await closeFlagsOnQuestion(getDb(), questionId, reviewer.id, why);
      await audit(
        reviewer,
        'flag.withdraw-question',
        { type: 'question', id: questionId },
        {
          reportsClosed: closed,
        },
      );
      // Learners and the public pages stop showing it.
      revalidatePublicContent();
    } else {
      const { questionId } = await closeFlag(
        getDb(),
        id,
        reviewer.id,
        decision === 'fixed' ? 'resolved' : 'dismissed',
        note,
      );
      await audit(reviewer, `flag.${decision}`, { type: 'flag', id }, { question: questionId });
    }
  } catch (error) {
    if (!(error instanceof ReviewError)) throw error;
    back(`problem=${encodeURIComponent(error.message)}`);
  }
  revalidatePath('/admin', 'layout');
  back(`done=${decision}`);
}
