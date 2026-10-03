import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SignInForm } from '@/components/auth/sign-in-form';
import { Notice } from '@/components/ui';
import { isAuthConfigured } from '@/lib/auth/server';
import { currentUser } from '@/lib/user';

export const metadata: Metadata = { title: 'Sign in | Oathly' };

export default async function SignInPage() {
  if (await currentUser()) redirect('/welcome');

  return (
    <main className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <h1 className="font-display text-4xl font-semibold">Sign in to Oathly</h1>
      <p className="text-fg-muted mt-3">
        New here? Signing in creates your account. Your progress is saved to it, so you can carry on
        from your phone or another computer.
      </p>
      <div className="mt-8">
        {isAuthConfigured() ? (
          <SignInForm />
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
