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
  /** A code has been emailed: waiting for it to be typed in. */
  | { step: 'code'; email: string; problem: string | null; checking: boolean }
  | { step: 'error'; message: string };

/**
 * Where to land after signing in: /welcome, carrying a country picked on the
 * landing page, or back to the invitation someone was about to accept.
 */
function useCallbackUrl(): string {
  const params = useSearchParams();
  const country = parseCountryCode(params.get('country'));
  const invitation = params.get('join');
  const path =
    invitation && /^[A-Za-z0-9_-]{20,100}$/.test(invitation)
      ? `/join/${invitation}`
      : country
        ? `/welcome?country=${country}`
        : '/welcome';
  // In the language being read.
  return useLocalePath()(path);
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

/**
 * Sign-in by a code sent to an email address, or with Google. A code rather
 * than a link: it is what the sign-in service offers, it is what the phone
 * app uses, and it works when the email is read on another device.
 *
 * Render inside <Suspense>: it reads ?country= from the query string.
 */
export function SignInForm() {
  const t = useT();
  const callbackUrl = useCallbackUrl();
  const [state, setState] = useState<State>({ step: 'ready' });

  async function sendCode(form: FormData) {
    const email = String(form.get('email') ?? '').trim();
    setState({ step: 'sending' });
    const authClient = await loadAuthClient();
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
    setState(
      error
        ? { step: 'error', message: error.message ?? t('auth.sendFailed') }
        : { step: 'code', email, problem: null, checking: false },
    );
  }

  async function checkCode(form: FormData) {
    if (state.step !== 'code') return;
    const { email } = state;
    const otp = String(form.get('code') ?? '').replace(/\s/g, '');
    setState({ step: 'code', email, problem: null, checking: true });
    const authClient = await loadAuthClient();
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    if (error) {
      setState({ step: 'code', email, problem: t('auth.codeFailed'), checking: false });
      return;
    }
    // A full load, so every page sees the new session from its first byte.
    window.location.assign(callbackUrl);
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

  if (state.step === 'code') {
    return (
      <form action={checkCode} className="space-y-4">
        <p role="status">{t('auth.codeSent', { email: state.email })}</p>
        {state.problem && (
          <Notice tone="error" role="alert">
            {state.problem}
          </Notice>
        )}
        <div>
          <label htmlFor="code" className={labelClass}>
            {t('auth.code')}
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={8}
            required
            autoFocus
            className={`${fieldClass} font-mono text-lg tracking-widest`}
          />
        </div>
        <button type="submit" disabled={state.checking} className={`${buttonClass.primary} w-full`}>
          {t('auth.verifyCode')}
        </button>
        <button
          type="button"
          onClick={() => setState({ step: 'ready' })}
          className={`${buttonClass.secondary} w-full`}
        >
          {t('auth.differentEmail')}
        </button>
      </form>
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
        action={sendCode}
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
          {t('auth.sendCode')}
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
