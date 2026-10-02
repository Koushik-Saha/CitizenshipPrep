import type { Metadata } from 'next';
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Lexend } from 'next/font/google';
import './globals.css';

// The variable names are the ones @oathly/tokens/theme.css reads (see
// `fontVariable` in the tokens package). next/font needs them as literals.
const display = Lexend({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--oathly-font-display',
});

// next/font has no fallback metrics for the Atkinson faces, so it cannot
// generate a size-adjusted fallback for them.
const body = Atkinson_Hyperlegible_Next({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  adjustFontFallback: false,
  variable: '--oathly-font-body',
});

const mono = Atkinson_Hyperlegible_Mono({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  variable: '--oathly-font-mono',
});

export const metadata: Metadata = {
  title: 'Oathly',
  description: 'Independent citizenship exam prep. Not affiliated with any government.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="bg-canvas text-fg font-sans antialiased">{children}</body>
    </html>
  );
}
