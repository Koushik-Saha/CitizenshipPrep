'use client';

import { useRouter } from 'next/navigation';

import { buttonClass } from '@/components/ui';
import { loadAuthClient } from '@/lib/auth/load-client';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={buttonClass.secondary}
      onPointerEnter={() => void loadAuthClient()}
      onFocus={() => void loadAuthClient()}
      onClick={async () => {
        await (await loadAuthClient()).signOut();
        router.push('/');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
