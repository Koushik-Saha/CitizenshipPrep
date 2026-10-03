import { loadStudySession } from '@oathly/api/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { StudySession } from '@/components/study/study-session';
import { getDb } from '@/lib/db';
import { requireMe } from '@/lib/user';

export const metadata: Metadata = { title: 'Study session | Oathly' };

// The whole session arrives with this page; after that, answering needs no
// network at all.
export default async function SessionPage({ params }: PageProps<'/study/session/[id]'>) {
  const { user } = await requireMe();
  const session = await loadStudySession(getDb(), user.userId, (await params).id);
  if (!session || session.questions.length === 0) notFound();
  return <StudySession session={session} />;
}
