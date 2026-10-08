'use server';

import {
  approveQuestion,
  approveTranslation,
  bulkQuestionActions,
  bulkTranslationActions,
  rejectQuestion,
  rejectTranslation,
  retireQuestion,
  reverifyQuestion,
  ReviewError,
  reviewQuestionsInBulk,
  reviewTranslationsInBulk,
  saveQuestionEdits,
  type BulkOutcome,
  type QuestionEdits,
  type TranslationEdits,
} from '@oathly/content/review';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDb, requireReviewer } from '@/lib/admin';
import { revalidatePublicContent } from '@/lib/revalidate';

// Each action checks who is asking, makes one decision through
// @oathly/content, then redirects. Problems the reviewer can fix come back as
// a message on the same screen; anything else is a real error.

const text = (form: FormData, name: string) => String(form.get(name) ?? '');

function readOptions(form: FormData) {
  return text(form, 'option_keys')
    .split(',')
    .filter(Boolean)
    .map((key) => ({ key, text: text(form, `option_${key}`) }));
}

function readQuestionEdits(form: FormData): QuestionEdits {
  return {
    text: text(form, 'text'),
    options: readOptions(form),
    correctKey: text(form, 'correct'),
    explanation: text(form, 'explanation'),
    topicId: text(form, 'topic'),
    difficulty: Number(text(form, 'difficulty')),
  };
}

function readTranslationEdits(form: FormData): TranslationEdits {
  return {
    text: text(form, 'text'),
    options: readOptions(form),
    explanation: text(form, 'explanation'),
  };
}

/** Runs a decision; returns the message to show if the reviewer needs to fix something. */
async function attempt(decision: (reviewerId: string) => Promise<void>): Promise<string | null> {
  const reviewer = await requireReviewer();
  try {
    await decision(reviewer.id);
    return null;
  } catch (error) {
    if (error instanceof ReviewError) return error.message;
    throw error;
  }
}

function finish(problem: string | null, here: string, next: string): never {
  revalidatePath('/admin/content', 'layout');
  // A decision can publish, change or withdraw what learners and visitors
  // see, so the public country and topic pages rebuild on their next visit.
  if (!problem) revalidatePublicContent();
  redirect(problem ? `${here}?problem=${encodeURIComponent(problem)}` : next);
}

const questionPath = (id: string) => `/admin/content/questions/${id}`;
const translationPath = (id: string, locale: string) =>
  `/admin/content/translations/${id}/${encodeURIComponent(locale)}`;

export async function saveQuestion(id: string, form: FormData) {
  const problem = await attempt((reviewerId) =>
    saveQuestionEdits(getDb(), id, reviewerId, readQuestionEdits(form)),
  );
  finish(problem, questionPath(id), `${questionPath(id)}?saved=1`);
}

export async function approve(id: string, form: FormData) {
  const problem = await attempt((reviewerId) =>
    approveQuestion(getDb(), id, reviewerId, readQuestionEdits(form)),
  );
  finish(problem, questionPath(id), '/admin/content?done=approved');
}

export async function reject(id: string, form: FormData) {
  const problem = await attempt((reviewerId) =>
    rejectQuestion(getDb(), id, reviewerId, text(form, 'note')),
  );
  finish(problem, questionPath(id), '/admin/content?done=rejected');
}

export async function reverify(id: string, form: FormData) {
  const problem = await attempt((reviewerId) =>
    reverifyQuestion(getDb(), id, reviewerId, text(form, 'note')),
  );
  finish(problem, questionPath(id), '/admin/content?view=source&done=reverified');
}

export async function retire(id: string, form: FormData) {
  const problem = await attempt((reviewerId) =>
    retireQuestion(getDb(), id, reviewerId, text(form, 'note')),
  );
  finish(problem, questionPath(id), '/admin/content?done=retired');
}

export async function approveTranslated(id: string, locale: string, form: FormData) {
  const problem = await attempt((reviewerId) =>
    approveTranslation(getDb(), id, locale, reviewerId, readTranslationEdits(form)),
  );
  finish(problem, translationPath(id, locale), '/admin/content?view=translations&done=approved');
}

export async function rejectTranslated(id: string, locale: string, form: FormData) {
  const problem = await attempt((reviewerId) =>
    rejectTranslation(getDb(), id, locale, reviewerId, text(form, 'note')),
  );
  finish(problem, translationPath(id, locale), '/admin/content?view=translations&done=rejected');
}

// --- Several at once -----------------------------------------------------------

/** The queue as it was filtered, to come back to: only its own query string is kept. */
function queueUrl(form: FormData, extra: Record<string, string>): string {
  const query = new URLSearchParams(text(form, 'back'));
  for (const name of ['done', 'count', 'failed', 'why', 'problem']) query.delete(name);
  for (const [name, value] of Object.entries(extra)) query.set(name, value);
  return `/admin/content?${query}`;
}

/**
 * One decision on everything ticked in the queue. Approving in bulk still
 * means the reviewer has checked each one: the form asks them to say so, and
 * nothing is approved unless they have.
 */
async function decideInBulk(
  form: FormData,
  actions: readonly string[],
  decide: (reviewerId: string, action: string, ids: string[], note: string) => Promise<BulkOutcome>,
): Promise<never> {
  const reviewer = await requireReviewer();
  const action = text(form, 'decision');
  const ids = form.getAll('ids').map(String);
  let outcome: BulkOutcome;
  try {
    if (!actions.includes(action)) throw new ReviewError('Choose what to do with them.');
    if (action === 'approve' && form.get('checked') !== 'on') {
      throw new ReviewError(
        'Tick the box to confirm you have checked each one against its source.',
      );
    }
    outcome = await decide(reviewer.id, action, ids, text(form, 'note'));
  } catch (error) {
    if (!(error instanceof ReviewError)) throw error;
    redirect(queueUrl(form, { problem: error.message }));
  }
  revalidatePath('/admin/content', 'layout');
  if (outcome.done > 0) revalidatePublicContent();
  redirect(
    queueUrl(form, {
      done: action,
      count: String(outcome.done),
      ...(outcome.failed.length > 0
        ? { failed: String(outcome.failed.length), why: outcome.failed[0]!.reason }
        : {}),
    }),
  );
}

export async function decideQuestions(form: FormData) {
  await decideInBulk(form, bulkQuestionActions, (reviewerId, action, ids, note) =>
    reviewQuestionsInBulk(
      getDb(),
      reviewerId,
      action as (typeof bulkQuestionActions)[number],
      ids,
      note,
    ),
  );
}

export async function decideTranslations(form: FormData) {
  await decideInBulk(form, bulkTranslationActions, (reviewerId, action, ids, note) =>
    reviewTranslationsInBulk(
      getDb(),
      reviewerId,
      action as (typeof bulkTranslationActions)[number],
      ids,
      note,
    ),
  );
}
