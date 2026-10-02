import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast';
import { colors, type ColorRole, type ThemeName } from './themes';

const AA_TEXT = 4.5;
const AA_UI = 3;

// [foreground, background, minimum ratio]
const pairs: [ColorRole, ColorRole, number][] = [
  ['fg', 'canvas', AA_TEXT],
  ['fg', 'surface', AA_TEXT],
  ['fg', 'surfaceRaised', AA_TEXT],
  ['fg', 'surfaceSunken', AA_TEXT],
  ['fgMuted', 'canvas', AA_TEXT],
  ['fgMuted', 'surface', AA_TEXT],
  ['fgMuted', 'surfaceSunken', AA_TEXT],
  ['fgSubtle', 'canvas', AA_TEXT],
  ['fgSubtle', 'surface', AA_TEXT],
  ['onPrimary', 'primary', AA_TEXT],
  ['onPrimary', 'primaryHover', AA_TEXT],
  ['primaryFg', 'canvas', AA_TEXT],
  ['primaryFg', 'surface', AA_TEXT],
  ['primaryFg', 'primarySoft', AA_TEXT],
  ['onAccent', 'accent', AA_TEXT],
  ['onAccent', 'accentHover', AA_TEXT],
  ['accentFg', 'canvas', AA_TEXT],
  ['accentFg', 'surface', AA_TEXT],
  ['accentFg', 'accentSoft', AA_TEXT],
  ['onSuccess', 'success', AA_TEXT],
  ['successFg', 'surface', AA_TEXT],
  ['successFg', 'successSoft', AA_TEXT],
  ['onError', 'error', AA_TEXT],
  ['errorFg', 'surface', AA_TEXT],
  ['errorFg', 'errorSoft', AA_TEXT],
  ['borderStrong', 'canvas', AA_UI],
  ['borderStrong', 'surface', AA_UI],
  ['focusRing', 'canvas', AA_UI],
  ['focusRing', 'surface', AA_UI],
  ['primary', 'canvas', AA_UI],
  ['primary', 'surface', AA_UI],
  ['logoInk', 'canvas', AA_UI],
  ['logoInk', 'surface', AA_UI],
  ['logoSeal', 'canvas', AA_UI],
  ['onLogoSeal', 'logoSeal', AA_UI],
];

describe.each(['light', 'dark'] satisfies ThemeName[])('%s theme', (theme) => {
  const roles = colors[theme];

  it.each(pairs)('%s on %s meets %d:1', (foreground, background, minimum) => {
    expect(contrastRatio(roles[foreground], roles[background])).toBeGreaterThanOrEqual(minimum);
  });
});

describe('themes', () => {
  it('define the same roles', () => {
    expect(Object.keys(colors.dark).sort()).toEqual(Object.keys(colors.light).sort());
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });
});
