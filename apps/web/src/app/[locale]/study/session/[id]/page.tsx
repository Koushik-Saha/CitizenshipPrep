import { loadStudySession } from '@oathly/api/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { StudySession } from '@/components/study/study-session';
import { getDb } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { requireMe } from '@/lib/user';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/study/session/[id]'>): Promise<Metadata> {
  return { title: (await getT(params)).t('session.metaTitle') };
}

// The whole session arrives with this page; after that, answering needs no
// network at all.
export default async function SessionPage({ params }: PageProps<'/[locale]/study/session/[id]'>) {
  const { locale } = await getT(params);
  const { user } = await requireMe(locale);
  const session = await loadStudySession(getDb(), user.userId, (await params).id);
  if (!session || session.questions.length === 0) notFound();
  return <StudySession session={session} />;
}
