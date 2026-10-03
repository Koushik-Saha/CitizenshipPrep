import { hello } from '@oathly/core';
import Link from 'next/link';

import { buttonClass } from '@/components/ui';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">{hello()}</h1>
      <Link href="/sign-in" className={buttonClass.primary}>
        Sign in
      </Link>
    </main>
  );
}
