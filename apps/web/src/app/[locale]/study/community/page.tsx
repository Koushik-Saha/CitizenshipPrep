import { postSorts, type PostSort } from '@oathly/api/community';
import { listPosts } from '@oathly/api/server';
import { POST_BODY_MAX, POST_TITLE_MAX, postKinds, type PostKind } from '@oathly/core';
import { countryName, localizePath } from '@oathly/i18n';
import type { Metadata } from 'next';

import Link from '@/components/link';
import {
  Byline,
  HeldNotice,
  KindBadge,
  kindLabel,
  LegalNotice,
  OutcomeNotice,
} from '@/components/study/community';
import { buttonClass, fieldClass, focusRing, labelClass } from '@/components/ui';
import { getDb } from '@/lib/db';
import { getT } from '@/lib/i18n';
import { requireMe } from '@/lib/user';

import { submitPost } from './actions';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/study/community'>): Promise<Metadata> {
  return { title: (await getT(params)).t('community.metaTitle') };
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// A country's study group: what others preparing for the same test have
// asked, advised and been through. Everything shown has been screened.
export default async function CommunityPage({
  params,
  searchParams,
}: PageProps<'/[locale]/study/community'>) {
  const { locale, t } = await getT(params);
  const { user, me } = await requireMe(locale);
  if (me.studyCountries.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="font-display text-4xl font-semibold">{t('community.title')}</h1>
        <p className="mt-4">
          <Link href={localizePath(locale, '/onboarding')} className={buttonClass.primary}>
            {t('common.backToStudy')}
          </Link>
        </p>
      </main>
    );
  }
  const query = await searchParams;
  const asked = one(query.country)?.toUpperCase();
  const country =
    me.studyCountries.find((candidate) => candidate.countryCode === asked) ??
    me.studyCountries.find((candidate) => candidate.isPrimary) ??
    me.studyCountries[0]!;
  const code = country.countryCode;
  const kind = postKinds.find((candidate) => candidate === one(query.kind)) ?? null;
  const sort: PostSort = postSorts.find((candidate) => candidate === one(query.sort)) ?? 'new';
  const posts = await listPosts(getDb(), user.userId, code, { kind, sort });
  const nameOf = (item: (typeof me.studyCountries)[number]) =>
    countryName(item.countryCode, locale, item.countryName);

  const href = (change: { country?: string; kind?: PostKind | null; sort?: PostSort }) => {
    const next = { country: code, kind, sort, ...change };
    const search = new URLSearchParams({ country: next.country });
    if (next.kind) search.set('kind', next.kind);
    if (next.sort !== 'new') search.set('sort', next.sort);
    return localizePath(locale, `/study/community?${search}`);
  };
  const pill = (active: boolean) =>
    `${focusRing} rounded-full border px-3 py-1.5 text-sm font-medium ${
      active
        ? 'bg-primary text-on-primary border-primary'
        : 'border-border-strong hover:bg-surface-sunken'
    }`;
  const card = 'bg-surface border-border rounded-lg border p-5';

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-sm">
        <Link
          href={localizePath(locale, '/study')}
          prefetch
          className={`${focusRing} text-fg-muted hover:text-fg rounded-xs underline-offset-4 hover:underline`}
        >
          ← {t('common.backToStudy')}
        </Link>
      </p>
      <h1 className="font-display mt-4 text-4xl font-semibold">{t('community.title')}</h1>
      <p className="text-fg-muted mt-2">{t('community.intro', { country: nameOf(country) })}</p>
      <p className="text-fg-muted mt-1 text-sm">{t('community.rules')}</p>

      <div className="mt-6 space-y-3">
        <OutcomeNotice t={t} notice={one(query.notice)} />
      </div>

      {me.studyCountries.length > 1 && (
        <nav aria-label={t('community.group')} className="mt-6 flex flex-wrap gap-2">
          {me.studyCountries.map((item) => (
            <Link
              key={item.countryCode}
              href={href({ country: item.countryCode, kind: null, sort: 'new' })}
              aria-current={item.countryCode === code ? 'page' : undefined}
              className={pill(item.countryCode === code)}
            >
              {nameOf(item)}
            </Link>
          ))}
        </nav>
      )}

      <details className={`${card} mt-6`}>
        <summary className={`${focusRing} cursor-pointer rounded-xs text-lg font-semibold`}>
          {t('community.newPost')}
        </summary>
        <form action={submitPost} className="mt-4 space-y-4">
          <input type="hidden" name="countryCode" value={code} />
          <div>
            <label htmlFor="post-kind" className={labelClass}>
              {t('community.kindLabel')}
            </label>
            <select id="post-kind" name="kind" defaultValue="discussion" className={fieldClass}>
              {postKinds.map((option) => (
                <option key={option} value={option}>
                  {kindLabel(t, option)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="post-title" className={labelClass}>
              {t('community.titleLabel')}
            </label>
            <input
              id="post-title"
              name="title"
              required
              minLength={3}
              maxLength={POST_TITLE_MAX}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="post-body" className={labelClass}>
              {t('community.bodyLabel')}
            </label>
            <textarea
              id="post-body"
              name="body"
              required
              minLength={3}
              maxLength={POST_BODY_MAX}
              rows={5}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="post-exam-date" className={labelClass}>
              {t('community.examDateLabel')} ({t('community.kindStory')})
            </label>
            <input id="post-exam-date" name="examDate" type="date" className={fieldClass} />
          </div>
          <button type="submit" className={buttonClass.primary}>
            {t('community.post')}
          </button>
        </form>
      </details>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t('community.kindLabel')} className="flex flex-wrap gap-2">
          <Link
            href={href({ kind: null })}
            aria-current={kind === null ? 'true' : undefined}
            className={pill(kind === null)}
          >
            {t('community.all')}
          </Link>
          {postKinds.map((option) => (
            <Link
              key={option}
              href={href({ kind: option })}
              aria-current={kind === option ? 'true' : undefined}
              className={pill(kind === option)}
            >
              {kindLabel(t, option)}
            </Link>
          ))}
        </nav>
        <nav aria-label={t('community.sortNew')} className="flex gap-2">
          {postSorts.map((option) => (
            <Link
              key={option}
              href={href({ sort: option })}
              aria-current={sort === option ? 'true' : undefined}
              className={pill(sort === option)}
            >
              {t(option === 'new' ? 'community.sortNew' : 'community.sortTop')}
            </Link>
          ))}
        </nav>
      </div>

      {posts.length === 0 ? (
        <p className="text-fg-muted mt-8">{t('community.empty')}</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {posts.map((post) => (
            <li key={post.id} className={card} data-testid="community-post">
              <div className="flex flex-wrap items-center gap-2">
                <KindBadge t={t} kind={post.kind} />
                <Byline t={t} post={post} />
              </div>
              <h2 className="mt-2 text-xl font-semibold">
                <Link
                  href={localizePath(locale, `/study/community/${post.id}`)}
                  className={`${focusRing} rounded-xs underline-offset-4 hover:underline`}
                >
                  {post.title}
                </Link>
              </h2>
              <p className="mt-1 line-clamp-3 whitespace-pre-line">{post.body}</p>
              <p className="text-fg-muted mt-3 text-sm">
                {t('community.helpfulCount', { count: post.upvotes })} ·{' '}
                {t('community.commentCount', { count: post.comments })}
              </p>
              <div className="mt-3 space-y-3 empty:hidden">
                <HeldNotice t={t} heldFor={post.heldFor} />
                {post.legalNotice && post.heldFor.length === 0 && <LegalNotice t={t} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
