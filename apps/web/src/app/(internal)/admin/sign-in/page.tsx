import { adminReturnPath, isStaffSessionCurrent } from '@oathly/api/admin-session';
import { isSecondFactorReadable, staffMember, startEnrollment } from '@oathly/api/server';
import { otpauthUri, spellSecret } from '@oathly/api/totp';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { LogoLockup } from '@/components/brand/logo';
import { buttonClass, fieldClass, labelClass, Notice } from '@/components/ui';
import { sharedAccountOpen } from '@/lib/admin';
import {
  ADMIN_SESSION_COOKIE,
  isAdminConfigured,
  readAdminCookie,
  secondFactorKey,
} from '@/lib/admin-credentials';
import { getDb } from '@/lib/db';
import { qrDataUri } from '@/lib/qr';
import { currentUser } from '@/lib/user';

import { confirmAuthenticator, enterCode, enterSharedAccount } from './actions';

export const metadata: Metadata = {
  title: 'Sign in | Oathly content review',
  robots: { index: false, follow: false },
};

const notices = {
  code: {
    tone: 'error',
    text: 'That code is not right, or has already been used. Try the next one.',
  },
  wrong: { tone: 'error', text: 'That username or password is not right.' },
  wait: { tone: 'error', text: 'Too many tries. Wait fifteen minutes and try again.' },
  closed: { tone: 'error', text: 'That sign-in is closed. Sign in with your own account.' },
  out: { tone: 'success', text: 'You are signed out of the reviewers’ area.' },
} as const;

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function Frame({
  title,
  intro,
  notice,
  children,
}: {
  title: string;
  intro: string;
  notice?: (typeof notices)[keyof typeof notices];
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <LogoLockup variant="meridian" layout="integrated" height={28} />
        </div>
        <div className="bg-surface border-border rounded-xl border p-6 shadow-md sm:p-8">
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          <p className="text-fg-muted mt-1 text-sm">{intro}</p>
          {notice && (
            <div className="mt-5">
              <Notice tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>
                {notice.text}
              </Notice>
            </div>
          )}
          {children}
        </div>
        <p className="text-fg-muted mt-6 text-center text-sm">
          For Oathly staff. Learners sign in at{' '}
          <Link href="/sign-in" className="text-primary-fg underline underline-offset-4">
            the study app
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

function CodeField() {
  return (
    <div>
      <label htmlFor="code" className={labelClass}>
        Six-digit code
      </label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        pattern="[0-9 ]*"
        maxLength={7}
        autoComplete="one-time-code"
        required
        autoFocus
        className={`${fieldClass} font-mono tracking-widest`}
      />
    </div>
  );
}

/** The shared account that came before: shown only while no admin has an authenticator. */
function SharedAccountForm({ next }: { next: string }) {
  return (
    <form action={enterSharedAccount} className="mt-6 space-y-4">
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
      <button type="submit" className={`${buttonClass.secondary} w-full`}>
        Sign in with the shared account
      </button>
    </form>
  );
}

// The way into the reviewers' area. Staff arrive already signed in to the
// site with their own account; this asks for a code from their authenticator,
// or sets one up the first time. Anyone else is sent away: signed out, to
// the site's sign-in; signed in without a staff role, to the front page.
export default async function AdminSignIn({ searchParams }: PageProps<'/admin/sign-in'>) {
  if (!isAdminConfigured()) notFound();
  const params = await searchParams;
  const next = adminReturnPath(single(params.next));
  const notice = notices[single(params.problem) as keyof typeof notices];
  const cookie = readAdminCookie((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  const sharedOpen = await sharedAccountOpen();
  // Already in with the shared account, while it is still allowed.
  if (cookie?.kind === 'shared' && sharedOpen) redirect(next);

  const user = await currentUser();
  const member = user ? await staffMember(getDb(), user.userId) : null;

  if (!user || !member) {
    if (!sharedOpen) redirect(user ? '/' : '/sign-in?admin=1');
    // Only until the first admin has set up an authenticator.
    return (
      <Frame
        title="Content review"
        intro="Sign in with your own Oathly account. The shared account below stops working as soon as an admin has set up an authenticator."
        notice={notice}
      >
        {!user && (
          <Link href="/sign-in?admin=1" className={`${buttonClass.primary} mt-6 w-full`}>
            Sign in with your Oathly account
          </Link>
        )}
        <SharedAccountForm next={next} />
      </Frame>
    );
  }

  // In already, as themselves.
  if (
    cookie?.kind === 'staff' &&
    cookie.userId === user.userId &&
    isStaffSessionCurrent(cookie, member)
  ) {
    redirect(next);
  }

  if (member.secondFactorInUse) {
    // Set up under a secret this server no longer holds: no code can be checked.
    if (!(await isSecondFactorReadable(getDb(), secondFactorKey(), user.userId))) {
      return (
        <Frame
          title="Your authenticator needs resetting"
          intro="It was set up before this server’s admin secret was changed, so its codes can no longer be checked."
        >
          <p className="mt-6 text-sm">
            Whoever runs the service resets it from the command line, and you set it up again here:
          </p>
          <code className="bg-surface-sunken mt-2 block rounded-md px-3 py-2 font-mono text-sm break-all">
            pnpm content staff-reset-2fa --user {user.userId}
          </code>
        </Frame>
      );
    }
    return (
      <Frame
        title="Enter your code"
        intro={`Signed in as ${member.displayName || user.email || 'staff'}. Open your authenticator app and enter the code for Oathly.`}
        notice={notice}
      >
        <form action={enterCode} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <CodeField />
          <button type="submit" className={`${buttonClass.primary} w-full`}>
            Continue
          </button>
        </form>
      </Frame>
    );
  }

  // First time: the secret to put into an authenticator app. It is shown
  // until the first code from it is accepted, and never again.
  const secret = await startEnrollment(getDb(), secondFactorKey(), user.userId);
  if (!secret) redirect('/admin/sign-in');
  const account = user.email || member.displayName || 'staff';
  const uri = otpauthUri(secret, account);
  return (
    <Frame
      title="Set up your authenticator"
      intro="The reviewers’ area asks for a code from an authenticator app each time you sign in. Set it up once."
      notice={notice}
    >
      <ol className="mt-6 list-decimal space-y-4 ps-5 text-sm">
        <li>
          Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator,
          1Password, Authy or similar) and choose to add an account by scanning a QR code.
        </li>
        <li>
          Scan this code.
          {/* Drawn by this server: the code holds the secret, so no other site is asked to make it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUri(uri)}
            alt="QR code to add Oathly to your authenticator app"
            width={208}
            height={208}
            data-testid="totp-qr"
            className="border-border mt-3 block rounded-md border bg-white"
          />
          <details className="mt-3">
            <summary className="text-primary-fg cursor-pointer py-3 underline underline-offset-4">
              Cannot scan it? Enter the key instead
            </summary>
            <p className="mt-2">
              Choose “enter a setup key” in the app, name the account <strong>Oathly</strong>, pick
              time-based, and type:
            </p>
            <code
              data-testid="totp-secret"
              className="bg-surface-sunken mt-2 block rounded-md px-3 py-2 font-mono text-base break-all select-all"
            >
              {spellSecret(secret)}
            </code>
            <a
              href={uri}
              className="text-primary-fg mt-2 inline-flex min-h-11 items-center underline underline-offset-4"
            >
              On the phone itself? Open it in your authenticator app
            </a>
          </details>
        </li>
        <li>Enter the six-digit code the app now shows.</li>
      </ol>
      <form action={confirmAuthenticator} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next} />
        <CodeField />
        <button type="submit" className={`${buttonClass.primary} w-full`}>
          Turn it on and continue
        </button>
      </form>
    </Frame>
  );
}
