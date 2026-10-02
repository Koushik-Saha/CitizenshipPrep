'use server';

import {
  approveQuestion,
  approveTranslation,
  rejectQuestion,
  rejectTranslation,
  retireQuestion,
  reverifyQuestion,
  ReviewError,
  saveQuestionEdits,
  type QuestionEdits,
  type TranslationEdits,
} from '@oathly/content/review';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDb, requireReviewer } from '@/lib/admin';

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
