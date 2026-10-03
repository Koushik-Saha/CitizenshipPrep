'use client';

import { useState } from 'react';

import { buttonClass, fieldClass, labelClass, Notice } from '@/components/ui';
import { authClient } from '@/lib/auth/client';

type State =
  | { step: 'ready' }
  | { step: 'sending' }
  | { step: 'sent'; email: string }
  | { step: 'error'; message: string };

/** `callbackUrl`: where to land after signing in, /welcome unless the visitor picked a country first. */
export function SignInForm({ callbackUrl = '/welcome' }: { callbackUrl?: string }) {
  const [state, setState] = useState<State>({ step: 'ready' });

  async function sendLink(form: FormData) {
    const email = String(form.get('email') ?? '').trim();
    setState({ step: 'sending' });
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: callbackUrl });
    setState(
      error
        ? { step: 'error', message: error.message ?? 'We could not send the link. Try again.' }
        : { step: 'sent', email },
    );
  }

  async function continueWithGoogle() {
    setState({ step: 'sending' });
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: callbackUrl,
    });
    if (error)
      setState({ step: 'error', message: error.message ?? 'Google sign-in failed. Try again.' });
  }

  if (state.step === 'sent') {
    return (
      <div role="status" className="space-y-3">
        <h2 className="font-display text-xl font-medium">Check your email</h2>
        <p>
          We sent a sign-in link to <strong>{state.email}</strong>. It works once and expires soon.
          You can close this tab.
        </p>
        <button
          type="button"
          onClick={() => setState({ step: 'ready' })}
          className={buttonClass.secondary}
        >
          Use a different email
        </button>
      </div>
    );
  }

  const busy = state.step === 'sending';
  return (
    <div className="space-y-6">
      {state.step === 'error' && (
        <Notice tone="error" role="alert">
          {state.message}
        </Notice>
      )}
      <form action={sendLink} className="space-y-3">
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={fieldClass}
          />
        </div>
        <button type="submit" disabled={busy} className={`${buttonClass.primary} w-full`}>
          Email me a sign-in link
        </button>
      </form>
      <div className="text-fg-muted flex items-center gap-3 text-sm" aria-hidden="true">
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>
      <button
        type="button"
        onClick={continueWithGoogle}
        disabled={busy}
        className={`${buttonClass.secondary} w-full`}
      >
        Continue with Google
      </button>
    </div>
  );
}
