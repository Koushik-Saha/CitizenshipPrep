'use client';

import { parseCountryCode } from '@oathly/api/country-search';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { buttonClass, fieldClass, labelClass, Notice } from '@/components/ui';
import { loadAuthClient } from '@/lib/auth/load-client';

type State =
  | { step: 'ready' }
  | { step: 'sending' }
  | { step: 'sent'; email: string }
  | { step: 'error'; message: string };

/** Where to land after signing in: /welcome, carrying a country picked on the landing page. */
function useCallbackUrl(): string {
  const country = parseCountryCode(useSearchParams().get('country'));
  return country ? `/welcome?country=${country}` : '/welcome';
}

/**
 * The sign-in page is static, so it cannot know who is looking at it. This
 * asks once the page is up, and sends someone already signed in straight on.
 * Render inside <Suspense>: it reads the query string.
 */
export function ContinueIfSignedIn() {
  const router = useRouter();
  const callbackUrl = useCallbackUrl();
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me', { headers: { accept: 'application/json' } })
      .then((response) => {
        if (response.ok && !cancelled) router.replace(callbackUrl);
      })
      .catch(() => {
        // Offline or the server is down: the form still works when it is back.
      });
    return () => {
      cancelled = true;
    };
  }, [callbackUrl, router]);
  return null;
}

/** Render inside <Suspense>: it reads ?country= from the query string. */
export function SignInForm() {
  const callbackUrl = useCallbackUrl();
  const [state, setState] = useState<State>({ step: 'ready' });

  async function sendLink(form: FormData) {
    const email = String(form.get('email') ?? '').trim();
    setState({ step: 'sending' });
    const authClient = await loadAuthClient();
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: callbackUrl });
    setState(
      error
        ? { step: 'error', message: error.message ?? 'We could not send the link. Try again.' }
        : { step: 'sent', email },
    );
  }

  async function continueWithGoogle() {
    setState({ step: 'sending' });
    const authClient = await loadAuthClient();
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
      {/* The auth client downloads as soon as someone starts using the form. */}
      <form
        action={sendLink}
        onFocus={() => void loadAuthClient()}
        onPointerEnter={() => void loadAuthClient()}
        className="space-y-3"
      >
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
        onFocus={() => void loadAuthClient()}
        onPointerEnter={() => void loadAuthClient()}
        disabled={busy}
        className={`${buttonClass.secondary} w-full`}
      >
        Continue with Google
      </button>
    </div>
  );
}
