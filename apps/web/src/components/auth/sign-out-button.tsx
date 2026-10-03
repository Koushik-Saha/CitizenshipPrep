'use client';

import { useRouter } from 'next/navigation';

import { buttonClass } from '@/components/ui';
import { authClient } from '@/lib/auth/client';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={buttonClass.secondary}
      onClick={async () => {
        await authClient.signOut();
        router.push('/');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
