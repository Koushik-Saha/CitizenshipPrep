// Both faces were drawn for reading ease, which matters when the reader is
// studying in a second language: Lexend for headings, Atkinson Hyperlegible
// Next for everything else (its I, l and 1 cannot be mistaken for each other).

export const fontFamily = {
  display: {
    name: 'Lexend',
    fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  },
  body: {
    name: 'Atkinson Hyperlegible Next',
    // Noto Sans picks up the scripts Atkinson does not cover.
    fallback: ['Noto Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  },
  mono: {
    name: 'Atkinson Hyperlegible Mono',
    fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
  },
} as const;

export type FontFamilyName = keyof typeof fontFamily;

/**
 * The web app loads the font files and exposes the loaded family through this
 * custom property (next/font's `variable` option); the token name is the
 * fallback when it is not set.
 */
export const fontVariable: Record<FontFamilyName, string> = {
  display: '--oathly-font-display',
  body: '--oathly-font-body',
  mono: '--oathly-font-mono',
};

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export type FontWeightName = keyof typeof fontWeight;

export interface TypeStep {
  /** Font size in px (web converts to rem at 16px). */
  size: number;
  /** Line height in px. */
  lineHeight: number;
  /** Letter spacing in em. */
  letterSpacing: number;
}

/** The classical typographic scale (12, 14, 16, 18, 21, 24, 36, 48, 60, 72) plus a 30 step. */
export const typeScale = {
  xs: { size: 12, lineHeight: 16, letterSpacing: 0.01 },
  sm: { size: 14, lineHeight: 20, letterSpacing: 0.005 },
  base: { size: 16, lineHeight: 26, letterSpacing: 0 },
  lg: { size: 18, lineHeight: 28, letterSpacing: 0 },
  xl: { size: 21, lineHeight: 30, letterSpacing: -0.005 },
  '2xl': { size: 24, lineHeight: 32, letterSpacing: -0.01 },
  '3xl': { size: 30, lineHeight: 38, letterSpacing: -0.015 },
  '4xl': { size: 36, lineHeight: 44, letterSpacing: -0.02 },
  '5xl': { size: 48, lineHeight: 54, letterSpacing: -0.025 },
  '6xl': { size: 60, lineHeight: 64, letterSpacing: -0.03 },
  '7xl': { size: 72, lineHeight: 76, letterSpacing: -0.035 },
} as const satisfies Record<string, TypeStep>;

export type TypeScaleStep = keyof typeof typeScale;
