import { describe, expect, it } from 'vitest';

import { darkTheme, lightTheme, themeFor } from './theme';

describe('theme objects', () => {
  it('share everything except colours and shadows', () => {
    expect(lightTheme.spacing).toBe(darkTheme.spacing);
    expect(lightTheme.text).toEqual(darkTheme.text);
    expect(lightTheme.colors.canvas).not.toBe(darkTheme.colors.canvas);
    expect(lightTheme.shadows.md).not.toBe(darkTheme.shadows.md);
  });

  it('give React Native ready-to-use values', () => {
    expect(lightTheme.text.base).toEqual({ fontSize: 16, lineHeight: 26, letterSpacing: 0 });
    expect(lightTheme.text['4xl'].letterSpacing).toBe(-0.72);
    expect(lightTheme.shadows.xs).toBe('0px 1px 2px 0px rgba(11, 22, 48, 0.06)');
    expect(lightTheme.spacing[4]).toBe(16);
    expect(lightTheme.radii.md).toBe(12);
  });

  it('themeFor falls back to light', () => {
    expect(themeFor('dark')).toBe(darkTheme);
    expect(themeFor('light')).toBe(lightTheme);
    expect(themeFor(null)).toBe(lightTheme);
    expect(themeFor(undefined)).toBe(lightTheme);
  });
});
