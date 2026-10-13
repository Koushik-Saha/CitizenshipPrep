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

import { audit, getDb, requireReviewer } from '@/lib/admin';
import { questionHref, queueContext, queueHref } from '@/lib/review-queue';
import { revalidatePublicContent } from '@/lib/revalidate';

// Each action checks who is asking, makes one decision through
// @oathly/content, writes it to the record of what staff do, then redirects.
// Problems the reviewer can fix come back as a message on the same screen;
// anything else is a real error.

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

/**
 * Runs a decision and records it; returns the message to show if the reviewer
 * needs to fix something. `action` and `target` are what the record says was
 * done, and to what.
 */
async function attempt(
  action: string,
  target: { type: 'question' | 'translation'; id: string },
  decision: (reviewerId: string) => Promise<void>,
): Promise<string | null> {
  const reviewer = await requireReviewer();
  try {
    await decision(reviewer.id);
  } catch (error) {
    if (error instanceof ReviewError) return error.message;
    throw error;
  }
  await audit(reviewer, action, target);
  return null;
}

function finish(problem: string | null, here: string, next: string): never {
  revalidatePath('/admin/content', 'layout');
  // A decision can publish, change or withdraw what learners and visitors
  // see, so the public country and topic pages rebuild on their next visit.
  if (!problem) revalidatePublicContent();
  redirect(
    problem
      ? `${here}${here.includes('?') ? '&' : '?'}problem=${encodeURIComponent(problem)}`
      : next,
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where a decision on one question leads: back to that question if it could
 * not be made, otherwise on to the next one in the filter the reviewer is
 * working through, or to the queue when there is none. The form says which
 * filter ("queue") and which question comes next ("next"); the filter is read
 * through the same checks as the queue's own address, and "next" has to be a
 * question's id, so neither can send the reviewer anywhere else.
 */
function afterDecision(id: string, form: FormData, done: string) {
  const { query } = queueContext(new URLSearchParams(text(form, 'queue')));
  const next = text(form, 'next');
  return {
    here: questionHref(id, query),
    onward: UUID.test(next) ? questionHref(next, query, { done }) : queueHref(query, { done }),
    stay: (extra: Record<string, string>) => questionHref(id, query, extra),
  };
}

const translationPath = (id: string, locale: string) =>
  `/admin/content/translations/${id}/${encodeURIComponent(locale)}`;

export async function saveQuestion(id: string, form: FormData) {
  const problem = await attempt('question.edit', { type: 'question', id }, (reviewerId) =>
    saveQuestionEdits(getDb(), id, reviewerId, readQuestionEdits(form)),
  );
  const { here, stay } = afterDecision(id, form, 'saved');
  finish(problem, here, stay({ saved: '1' }));
}

export async function approve(id: string, form: FormData) {
  const problem = await attempt('question.approve', { type: 'question', id }, (reviewerId) =>
    approveQuestion(getDb(), id, reviewerId, readQuestionEdits(form)),
  );
  const { here, onward } = afterDecision(id, form, 'approved');
  finish(problem, here, onward);
}

export async function reject(id: string, form: FormData) {
  const problem = await attempt('question.reject', { type: 'question', id }, (reviewerId) =>
    rejectQuestion(getDb(), id, reviewerId, text(form, 'note')),
  );
  const { here, onward } = afterDecision(id, form, 'rejected');
  finish(problem, here, onward);
}

export async function reverify(id: string, form: FormData) {
  const problem = await attempt('question.reverify', { type: 'question', id }, (reviewerId) =>
    reverifyQuestion(getDb(), id, reviewerId, text(form, 'note')),
  );
  const { here, onward } = afterDecision(id, form, 'reverified');
  finish(problem, here, onward);
}

export async function retire(id: string, form: FormData) {
  const problem = await attempt('question.retire', { type: 'question', id }, (reviewerId) =>
    retireQuestion(getDb(), id, reviewerId, text(form, 'note')),
  );
  const { here, onward } = afterDecision(id, form, 'retired');
  finish(problem, here, onward);
}

export async function approveTranslated(id: string, locale: string, form: FormData) {
  const problem = await attempt(
    'translation.approve',
    { type: 'translation', id: `${id}/${locale}` },
    (reviewerId) => approveTranslation(getDb(), id, locale, reviewerId, readTranslationEdits(form)),
  );
  finish(problem, translationPath(id, locale), '/admin/content?view=translations&done=approved');
}

export async function rejectTranslated(id: string, locale: string, form: FormData) {
  const problem = await attempt(
    'translation.reject',
    { type: 'translation', id: `${id}/${locale}` },
    (reviewerId) => rejectTranslation(getDb(), id, locale, reviewerId, text(form, 'note')),
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
  kind: 'question' | 'translation',
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
    // Approving goes through a dialog that says how many will go out. What
    // it showed has to be what arrives: a count that differs means the
    // selection changed, or the dialog was skipped.
    if (action === 'approve' && Number(text(form, 'confirmed')) !== new Set(ids).size) {
      throw new ReviewError('Confirm how many you are approving, then approve them.');
    }
    outcome = await decide(reviewer.id, action, ids, text(form, 'note'));
  } catch (error) {
    if (!(error instanceof ReviewError)) throw error;
    redirect(queueUrl(form, { problem: error.message }));
  }
  // One line for the lot: which were asked for, and how many it was done to.
  await audit(reviewer, `${kind}.bulk-${action}`, null, {
    ids: [...new Set(ids)].slice(0, 200),
    done: outcome.done,
    failed: outcome.failed.length,
  });
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
  await decideInBulk(form, 'question', bulkQuestionActions, (reviewerId, action, ids, note) =>
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
  await decideInBulk(form, 'translation', bulkTranslationActions, (reviewerId, action, ids, note) =>
    reviewTranslationsInBulk(
      getDb(),
      reviewerId,
      action as (typeof bulkTranslationActions)[number],
      ids,
      note,
    ),
  );
}
