import { hello } from '@oathly/core';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <h1 className="text-2xl font-semibold">{hello()}</h1>
    </main>
  );
}
