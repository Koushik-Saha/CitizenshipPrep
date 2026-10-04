import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ContinueIfSignedIn, SignInForm } from '@/components/auth/sign-in-form';
import { Notice } from '@/components/ui';
import { isAuthConfigured } from '@/lib/auth/server';

export const metadata: Metadata = { title: 'Sign in | Oathly' };

// Static, so links to it prefetch the whole page and it opens at once.
// Rebuilt every minute so a change to the auth configuration shows up.
export const revalidate = 60;

export default function SignInPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <Suspense>
        <ContinueIfSignedIn />
      </Suspense>
      <h1 className="font-display text-4xl font-semibold">Sign in to Oathly</h1>
      <p className="text-fg-muted mt-3">
        New here? Signing in creates your account. Your progress is saved to it, so you can carry on
        from your phone or another computer.
      </p>
      <div className="mt-8">
        {isAuthConfigured() ? (
          // The form reads ?country= from the URL, which only the browser knows.
          <Suspense fallback={<div className="h-56" aria-hidden="true" />}>
            <SignInForm />
          </Suspense>
        ) : (
          <Notice tone="warning">Sign-in is not set up on this server yet.</Notice>
        )}
      </div>
      <p className="text-fg-muted mt-10 text-sm">
        Oathly is an independent study app. It is not affiliated with any government.
      </p>
    </main>
  );
}
