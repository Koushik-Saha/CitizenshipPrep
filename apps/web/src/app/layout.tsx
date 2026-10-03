import type { Metadata } from 'next';
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Lexend } from 'next/font/google';
import { ViewTransition } from 'react';

import { SceneHost } from '@/components/globe/scene-host';
import { RouteFade } from '@/components/route-fade';

import './globals.css';

// The variable names are the ones @oathly/tokens/theme.css reads (see
// `fontVariable` in the tokens package). next/font needs them as literals.
// `subsets` only decides which files are preloaded: latin-ext is still
// declared (by unicode-range) and loads when a page uses it.
const display = Lexend({
  subsets: ['latin'],
  display: 'swap',
  variable: '--oathly-font-display',
});

// next/font has no fallback metrics for the Atkinson faces, so it cannot
// generate a size-adjusted fallback for them.
const body = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
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
      <body className="bg-canvas text-fg font-sans antialiased">
        {/* Page changes cross-fade with the View Transitions API; RouteFade
            does it with Motion in browsers without it. */}
        <ViewTransition default="page">
          <RouteFade>{children}</RouteFade>
        </ViewTransition>
        {/* The app's one WebGL canvas, shared by every page that shows the globe. */}
        <SceneHost />
      </body>
    </html>
  );
}
