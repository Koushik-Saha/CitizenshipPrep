'use server';

import { startMockExam, startPractice, StudyError } from '@oathly/api/server';
import type { PracticeMode } from '@oathly/core';
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

const modes: readonly PracticeMode[] = ['random', 'adaptive', 'topic'];

export async function startPracticeSession(
  _previous: StartState,
  form: FormData,
): Promise<StartState> {
  const focus = String(form.get('focus') ?? 'adaptive');
  const mode = (modes.includes(focus as PracticeMode) ? focus : 'topic') as PracticeMode;
  return start((userId) =>
    startPractice(
      getDb(),
      userId,
      {
        countryCode: String(form.get('countryCode') ?? ''),
        mode,
        topicId: mode === 'topic' ? focus.replace(/^topic:/, '') : undefined,
        size: Number(form.get('size') ?? 10),
      },
      form.get('kind') === 'flashcards' ? 'flashcards' : 'practice',
    ),
  );
}

export async function startMockExamSession(
  _previous: StartState,
  form: FormData,
): Promise<StartState> {
  return start((userId) =>
    startMockExam(getDb(), userId, {
      countryCode: String(form.get('countryCode') ?? ''),
      examFormatId: String(form.get('examFormatId') ?? ''),
    }),
  );
}
