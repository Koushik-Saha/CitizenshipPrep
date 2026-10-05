'use client';

import { useRouter } from 'next/navigation';

import { useLocalePath, useT } from '@/components/i18n/provider';
import { buttonClass } from '@/components/ui';
import { loadAuthClient } from '@/lib/auth/load-client';

export function SignOutButton() {
  const router = useRouter();
  const t = useT();
  const localePath = useLocalePath();
  return (
    <button
      type="button"
      className={buttonClass.secondary}
      onPointerEnter={() => void loadAuthClient()}
      onFocus={() => void loadAuthClient()}
      onClick={async () => {
        await (await loadAuthClient()).signOut();
        router.push(localePath('/'));
        router.refresh();
      }}
    >
      {t('common.signOut')}
    </button>
  );
}
