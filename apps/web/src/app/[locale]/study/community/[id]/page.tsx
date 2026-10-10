import { getThread } from '@oathly/api/server';
import { COMMENT_MAX, reportReasons, type ReportReason } from '@oathly/core';
import { localizePath, type Translator } from '@oathly/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import Link from '@/components/link';
import {
  Byline,
  HeldNotice,
  KindBadge,
  LegalNotice,
  OutcomeNotice,
} from '@/components/study/community';
import { buttonClass, fieldClass, focusRing, labelClass } from '@/components/ui';
import { getDb } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { isCommunitySwitchedOff } from '@/lib/community';
import { requireMe } from '@/lib/user';

import { report, submitComment, vote } from '../actions';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/study/community/[id]'>): Promise<Metadata> {
  return { title: (await getT(params)).t('community.metaTitle') };
}

const reasonLabel = (t: Translator, reason: ReportReason) =>
  t(
    (
      {
        spam: 'community.reasonSpam',
        abuse: 'community.reasonAbuse',
        legal_advice: 'community.reasonLegal',
        off_topic: 'community.reasonOffTopic',
        other: 'community.reasonOther',
      } as const
    )[reason],
  );

/** "Report", opening to a reason and a button. A form of its own, with no script. */
function ReportForm({
  t,
  id,
  action,
}: {
  t: Translator;
  id: string;
  action: (form: FormData) => Promise<void>;
}) {
  return (
    <details className="text-sm">
      <summary className={`${focusRing} text-fg-muted hover:text-fg cursor-pointer rounded-xs`}>
        {t('community.report')}
      </summary>
      <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`reason-${id}`} className={labelClass}>
            {t('community.reportReason')}
          </label>
          <select id={`reason-${id}`} name="reason" defaultValue="spam" className={fieldClass}>
            {reportReasons.map((reason) => (
              <option key={reason} value={reason}>
                {reasonLabel(t, reason)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClass.secondary}>
          {t('community.reportSend')}
        </button>
      </form>
    </details>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PostPage({
  params,
  searchParams,
}: PageProps<'/[locale]/study/community/[id]'>) {
  const { locale, t } = await getT(params);
  if (isCommunitySwitchedOff()) notFound();
  const { user } = await requireMe(locale);
  const { id } = await params;
  const post = UUID.test(id) ? await getThread(getDb(), user.userId, id) : null;
  if (!post) notFound();
  const notice = (await searchParams).notice;
  const held = post.heldFor.length > 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-sm">
        <Link
          href={localizePath(locale, `/study/community?country=${post.countryCode}`)}
          prefetch
          className={`${focusRing} text-fg-muted hover:text-fg rounded-xs underline-offset-4 hover:underline`}
        >
          ← {t('community.back')}
        </Link>
      </p>

      <article className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge t={t} kind={post.kind} />
          <Byline t={t} post={post} />
        </div>
        <h1 className="font-display mt-2 text-3xl font-semibold">{post.title}</h1>
        <div className="mt-4 space-y-3 empty:hidden">
          <OutcomeNotice t={t} notice={Array.isArray(notice) ? notice[0] : notice} />
          <HeldNotice t={t} heldFor={post.heldFor} />
          {post.legalNotice && notice !== 'legal' && <LegalNotice t={t} />}
        </div>
        <p className="mt-4 whitespace-pre-line">{post.body}</p>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          {post.mine || held ? (
            <p className="text-fg-muted text-sm">
              {t('community.helpfulCount', { count: post.upvotes })}
            </p>
          ) : (
            <form action={vote.bind(null, post.id)}>
              <button
                type="submit"
                aria-pressed={post.voted}
                className={post.voted ? buttonClass.primary : buttonClass.secondary}
              >
                {t('community.helpful')} · {post.upvotes}
              </button>
            </form>
          )}
          {!post.mine && !held && (
            <ReportForm t={t} id={post.id} action={report.bind(null, post.id, null)} />
          )}
        </div>
      </article>

      <section id="comments" aria-labelledby="comments-heading" className="mt-10">
        <h2 id="comments-heading" className="text-xl font-semibold">
          {t('community.commentCount', { count: post.thread.length })}
        </h2>
        {post.thread.length === 0 ? (
          <p className="text-fg-muted mt-3">{t('community.noComments')}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {post.thread.map((comment) => (
              <li
                key={comment.id}
                className="bg-surface border-border rounded-lg border p-4"
                data-testid="community-comment"
              >
                <Byline t={t} post={{ ...comment, examDate: null }} />
                <p className="mt-2 whitespace-pre-line">{comment.body}</p>
                <div className="mt-3 space-y-2 empty:hidden">
                  <HeldNotice t={t} heldFor={comment.heldFor} comment />
                  {!comment.mine && (
                    <ReportForm
                      t={t}
                      id={comment.id}
                      action={report.bind(null, post.id, comment.id)}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!held && (
          <form action={submitComment.bind(null, post.id)} className="mt-6 space-y-3">
            <div>
              <label htmlFor="comment-body" className={labelClass}>
                {t('community.commentLabel')}
              </label>
              <textarea
                id="comment-body"
                name="body"
                required
                maxLength={COMMENT_MAX}
                rows={3}
                className={fieldClass}
              />
            </div>
            <button type="submit" className={buttonClass.primary}>
              {t('community.comment')}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
