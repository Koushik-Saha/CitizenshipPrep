import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Oathly',
  description: 'Independent citizenship exam prep. Not affiliated with any government.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
