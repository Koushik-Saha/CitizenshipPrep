'use client';

import { parseCountryCode } from '@oathly/api/country-search';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useLocalePath, useT } from '@/components/i18n/provider';
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
  // In the language being read, so the link in the email comes back in it.
  return useLocalePath()(country ? `/welcome?country=${country}` : '/welcome');
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
  const t = useT();
  const callbackUrl = useCallbackUrl();
  const [state, setState] = useState<State>({ step: 'ready' });

  async function sendLink(form: FormData) {
    const email = String(form.get('email') ?? '').trim();
    setState({ step: 'sending' });
    const authClient = await loadAuthClient();
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: callbackUrl });
    setState(
      error
        ? { step: 'error', message: error.message ?? t('auth.sendFailed') }
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
    if (error) setState({ step: 'error', message: error.message ?? t('auth.googleFailed') });
  }

  if (state.step === 'sent') {
    return (
      <div role="status" className="space-y-3">
        <h2 className="font-display text-xl font-medium">{t('auth.sentTitle')}</h2>
        <p>{t('auth.sentBody', { email: state.email })}</p>
        <button
          type="button"
          onClick={() => setState({ step: 'ready' })}
          className={buttonClass.secondary}
        >
          {t('auth.differentEmail')}
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
            {t('auth.email')}
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
          {t('auth.sendLink')}
        </button>
      </form>
      <div className="text-fg-muted flex items-center gap-3 text-sm" aria-hidden="true">
        <span className="bg-border h-px flex-1" />
        {t('auth.or')}
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
        {t('auth.google')}
      </button>
    </div>
  );
}
