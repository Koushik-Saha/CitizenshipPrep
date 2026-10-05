import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Lexend } from 'next/font/google';

// The variable names are the ones @oathly/tokens/theme.css reads (see
// `fontVariable` in the tokens package). next/font needs them as literals.
//
// `subsets` only decides which files are preloaded: latin-ext is still
// declared (by unicode-range) and loads when a page uses it. Scripts these
// faces do not cover (Arabic, Devanagari, Bengali, Chinese) fall through the
// font stack to the reader's system fonts.
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

/** Class names that define the font variables: put on <html>. */
export const fontVariables = `${display.variable} ${body.variable} ${mono.variable}`;
