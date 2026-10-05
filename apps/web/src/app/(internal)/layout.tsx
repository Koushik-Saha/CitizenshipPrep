import type { Metadata } from 'next';

import { fontVariables } from '@/lib/fonts';

import '../globals.css';

// Reviewer and brand pages: internal tools, in English only.
export const metadata: Metadata = {
  title: 'Oathly',
  robots: { index: false, follow: false },
};

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="bg-canvas text-fg font-sans antialiased">{children}</body>
    </html>
  );
}
