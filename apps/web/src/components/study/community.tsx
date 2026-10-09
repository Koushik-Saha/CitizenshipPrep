import type { CommunityPost } from '@oathly/api/community';
import type { HoldReason, PostKind } from '@oathly/core';
import type { Translator } from '@oathly/i18n';

import { Badge, Notice } from '@/components/ui';

// Pieces shared by the group page and a post's own page. Server Components.

export const kindLabel = (t: Translator, kind: PostKind) =>
  t(
    kind === 'story'
      ? 'community.kindStory'
      : kind === 'tip'
        ? 'community.kindTip'
        : 'community.kindDiscussion',
  );

export function KindBadge({ t, kind }: { t: Translator; kind: PostKind }) {
  return <Badge tone={kind === 'story' ? 'success' : 'neutral'}>{kindLabel(t, kind)}</Badge>;
}

/** Who wrote it and when, and for a story when they sat the exam. */
export function Byline({
  t,
  post,
}: {
  t: Translator;
  post: Pick<CommunityPost, 'author' | 'mine' | 'createdAt' | 'examDate'>;
}) {
  const date = new Intl.DateTimeFormat(t.locale, { dateStyle: 'medium' });
  return (
    <p className="text-fg-muted text-sm">
      <span>{post.mine ? t('community.you') : (post.author ?? t('community.someone'))}</span>
      {' · '}
      <time dateTime={post.createdAt}>{date.format(new Date(post.createdAt))}</time>
      {post.examDate && (
        <>
          {' · '}
          {t('community.satOn', {
            date: new Intl.DateTimeFormat(t.locale, {
              dateStyle: 'medium',
              timeZone: 'UTC',
            }).format(new Date(`${post.examDate}T00:00:00Z`)),
          })}
        </>
      )}
    </p>
  );
}

/** Told to the writer alone: their post or comment is not showing, and why. */
export function HeldNotice({
  t,
  heldFor,
  comment = false,
}: {
  t: Translator;
  heldFor: readonly HoldReason[];
  comment?: boolean;
}) {
  if (heldFor.length === 0) return null;
  return (
    <Notice tone="warning">
      {heldFor.includes('removed')
        ? t('community.removed')
        : t(comment ? 'community.heldComment' : 'community.held')}
    </Notice>
  );
}

/** The community is for studying: a question about someone's own case gets this beside it. */
export function LegalNotice({ t }: { t: Translator }) {
  return (
    <Notice tone="warning">
      <p className="font-semibold">{t('community.legalTitle')}</p>
      <p className="mt-1">{t('community.legalNotice')}</p>
    </Notice>
  );
}

const outcomes: Record<
  string,
  { key: Parameters<Translator>[0]; tone: 'success' | 'warning' | 'error' }
> = {
  held: { key: 'community.held', tone: 'warning' },
  reported: { key: 'community.reported', tone: 'success' },
  wait: { key: 'community.tooMany', tone: 'error' },
  invalid: { key: 'community.invalid', tone: 'error' },
};

/** What happened to the last thing the learner did, from the page's address. */
export function OutcomeNotice({ t, notice }: { t: Translator; notice: string | undefined }) {
  if (notice === 'legal') return <LegalNotice t={t} />;
  const found = notice ? outcomes[notice] : undefined;
  if (!found) return null;
  return (
    <Notice tone={found.tone} role={found.tone === 'error' ? 'alert' : 'status'}>
      {t(found.key)}
    </Notice>
  );
}
