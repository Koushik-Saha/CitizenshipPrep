import { adminReturnPath } from '@oathly/api/admin-session';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { LogoLockup } from '@/components/brand/logo';
import { buttonClass, fieldClass, labelClass, Notice } from '@/components/ui';
import {
  ADMIN_SESSION_COOKIE,
  isAdminConfigured,
  verifyAdminCookie,
} from '@/lib/admin-credentials';

import { signIn } from './actions';

export const metadata: Metadata = {
  title: 'Sign in | Oathly content review',
  robots: { index: false, follow: false },
};

const notices = {
  wrong: { tone: 'error', text: 'That username or password is not right.' },
  wait: { tone: 'error', text: 'Too many tries. Wait a few minutes and try again.' },
  out: { tone: 'success', text: 'You are signed out.' },
} as const;

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// The reviewers' sign-in. Not the learners': theirs is /sign-in.
export default async function AdminSignIn({ searchParams }: PageProps<'/admin/sign-in'>) {
  if (!isAdminConfigured()) notFound();
  const params = await searchParams;
  const next = adminReturnPath(single(params.next));
  // Already signed in: straight on.
  if (verifyAdminCookie((await cookies()).get(ADMIN_SESSION_COOKIE)?.value)) redirect(next);
  const notice = notices[single(params.problem) as keyof typeof notices];

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <LogoLockup variant="meridian" layout="integrated" height={28} />
        </div>
        <div className="bg-surface border-border rounded-xl shadow-md border p-6 sm:p-8">
          <h1 className="font-display text-2xl font-semibold">Content review</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Sign in to review questions and translations.
          </p>

          {notice && (
            <div className="mt-5">
              <Notice tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>
                {notice.text}
              </Notice>
            </div>
          )}

          <form action={signIn} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <label htmlFor="username" className={labelClass}>
                Username
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={fieldClass}
              />
            </div>
            <button type="submit" className={`${buttonClass.primary} w-full`}>
              Sign in
            </button>
          </form>
        </div>
        <p className="text-fg-muted mt-6 text-center text-sm">
          For Oathly reviewers. Learners sign in at{' '}
          <Link href="/sign-in" className="text-primary-fg underline underline-offset-4">
            the study app
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
