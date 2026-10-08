'use client';

import { useState } from 'react';

import { useLocalePath, useT } from '@/components/i18n/provider';
import { buttonClass, Notice } from '@/components/ui';
import { loadAuthClient } from '@/lib/auth/load-client';

const blockedMessage = {
  organization: 'profile.deleteBlockedOrganization',
  staff: 'profile.deleteBlockedStaff',
} as const;

/**
 * Deleting the account, after saying plainly what goes and ticking that it is
 * understood. `stores` names the phone stores where a subscription has to be
 * cancelled by hand first; `hasWebSubscription` says one will be cancelled here.
 */
export function DeleteAccount({
  stores,
  hasWebSubscription,
  signInConfigured,
}: {
  stores: boolean;
  hasWebSubscription: boolean;
  signInConfigured: boolean;
}) {
  const t = useT();
  const localePath = useLocalePath();
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch('/api/me', { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { reason?: string } | null;
        const key = blockedMessage[body?.reason as keyof typeof blockedMessage];
        setProblem(t(key ?? 'profile.deleteFailed'));
        setBusy(false);
        return;
      }
      if (signInConfigured) {
        // What was made here is gone. The sign-in account is kept by the
        // sign-in service: remove it there too, then end the session. If the
        // service refuses, nothing of the learner's study is left either way.
        const auth = await loadAuthClient();
        await auth.deleteUser().catch(() => null);
        await auth.signOut().catch(() => null);
      }
      window.location.assign(localePath('/account-deleted'));
    } catch {
      setProblem(t('profile.deleteFailed'));
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="delete-account" className="border-border mt-12 border-t pt-8">
      <h2 id="delete-account" className="font-display text-2xl font-semibold">
        {t('profile.deleteTitle')}
      </h2>
      <p className="mt-3 max-w-prose">{t('profile.deleteIntro')}</p>
      {hasWebSubscription && <p className="mt-3 max-w-prose">{t('profile.deleteStripe')}</p>}
      {stores && (
        <div className="mt-4 max-w-prose">
          <Notice tone="warning">{t('profile.deleteStores')}</Notice>
        </div>
      )}
      <label className="mt-6 flex max-w-prose items-start gap-3">
        <input
          type="checkbox"
          className="accent-primary mt-1 size-4"
          checked={understood}
          onChange={(event) => setUnderstood(event.target.checked)}
        />
        <span>{t('profile.deleteConfirm')}</span>
      </label>
      {problem && (
        <div className="mt-4 max-w-prose">
          <Notice tone="error" role="alert">
            {problem}
          </Notice>
        </div>
      )}
      <button
        type="button"
        className={`${buttonClass.danger} mt-6`}
        disabled={!understood || busy}
        onClick={() => void remove()}
      >
        {t('profile.deleteButton')}
      </button>
    </section>
  );
}
