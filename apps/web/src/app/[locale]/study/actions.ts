'use server';

import { startSessionRequestSchema } from '@oathly/api/schemas';
import { startSession, StudyError } from '@oathly/api/server';
import { redirect } from 'next/navigation';

import { getDb } from '@/lib/db';
import { localizedPath } from '@/lib/i18n';
import { currentUser } from '@/lib/user';

// Starting a session picks its questions on the server (with the quiz
// engine), stores the list on the attempt, then opens the session page,
// which loads it all at once.

export interface StartState {
  error: string | null;
}

async function start(work: (userId: string) => Promise<string>): Promise<StartState> {
  const user = await currentUser();
  if (!user) redirect(await localizedPath('/sign-in'));
  let attemptId: string;
  try {
    attemptId = await work(user.userId);
  } catch (error) {
    if (error instanceof StudyError) return { error: error.message };
    throw error;
  }
  redirect(await localizedPath(`/study/session/${attemptId}`));
}

/** Starts what a form asked for, once it has been through the same check as the API's requests. */
function startChecked(request: unknown): Promise<StartState> {
  const parsed = startSessionRequestSchema.safeParse(request);
  if (!parsed.success) {
    return Promise.resolve({ error: 'That is not a session this app can start.' });
  }
  return start((userId) => startSession(getDb(), userId, parsed.data));
}

export async function startPracticeSession(
  _previous: StartState,
  form: FormData,
): Promise<StartState> {
  // "adaptive", "random", or "topic:<id>".
  const focus = String(form.get('focus') ?? 'adaptive');
  return startChecked({
    kind: form.get('kind') === 'flashcards' ? 'flashcards' : 'practice',
    countryCode: String(form.get('countryCode') ?? ''),
    focus:
      focus === 'adaptive' || focus === 'random'
        ? focus
        : { topicId: focus.replace(/^topic:/, '') },
    size: Number(form.get('size') ?? 10),
  });
}

export async function startMockExamSession(
  _previous: StartState,
  form: FormData,
): Promise<StartState> {
  return startChecked({
    kind: 'mock_exam',
    countryCode: String(form.get('countryCode') ?? ''),
    examFormatId: String(form.get('examFormatId') ?? ''),
  });
}
