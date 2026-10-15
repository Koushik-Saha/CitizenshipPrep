'use server';

import { markExamFormatChecked } from '@oathly/content/exam-formats';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { audit, getDb, requireReviewer } from '@/lib/admin';
import { revalidatePublicContent } from '@/lib/revalidate';

/**
 * A reviewer confirms that an exam's facts match its official page, as of
 * now. The tick box says so in words: it is a statement about having read
 * the source, which is what the public pages then repeat ("checked on …").
 */
export async function checkExamFormat(form: FormData): Promise<void> {
  const reviewer = await requireReviewer();
  if (form.get('read') !== 'on') redirect('/admin/exams?problem=unconfirmed');
  const checked = await markExamFormatChecked(getDb(), String(form.get('id') ?? ''), reviewer.id);
  if (!checked) redirect('/admin/exams?problem=missing');
  await audit(
    reviewer,
    'exam-format.checked',
    { type: 'exam_format', id: String(form.get('id')) },
    { country: checked.countryCode, name: checked.name },
  );
  revalidatePublicContent(checked.countrySlug);
  revalidatePath('/admin/exams');
  redirect(`/admin/exams?done=${encodeURIComponent(checked.name)}`);
}
