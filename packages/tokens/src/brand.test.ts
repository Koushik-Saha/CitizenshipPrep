import { describe, expect, it } from 'vitest';

import { brandCss, brandRoles, brandShades, mixHex } from './brand';
import { contrastRatio } from './contrast';
import { colors, type ThemeName } from './themes';

const themes: ThemeName[] = ['light', 'dark'];
// Colours an organization might pick, including ones that are hard to read
// on a light or a dark page.
const picked = [
  '#000000',
  '#ffffff',
  '#777777',
  '#ffeb3b',
  '#0b5fff',
  '#d32f2f',
  '#00c853',
  '#ff6f00',
  '#7b1fa2',
  '#1b2a4a',
  '#f5f0e6',
  '#00bcd4',
];

describe('mixHex', () => {
  it('mixes two colours', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#FF0000', '#0000ff', 0.25)).toBe('#bf0040');
  });
});

describe('brandShades', () => {
  for (const theme of themes) {
    const { surface, canvas } = colors[theme];
    for (const color of picked) {
      it(`keeps ${color} readable in the ${theme} theme`, () => {
        const shades = brandShades(color, theme);
        // Text on a filled button.
        expect(contrastRatio(shades.onFill, shades.fill)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(shades.onFill, shades.fillHover)).toBeGreaterThanOrEqual(4.5);
        // The button against the page.
        expect(contrastRatio(shades.fill, surface)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(shades.fill, canvas)).toBeGreaterThanOrEqual(3);
        // Links and tinted badges.
        expect(contrastRatio(shades.fg, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(shades.fg, canvas)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(shades.fg, shades.soft)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('leaves a colour alone where it already works', () => {
    expect(brandShades('#0B5FFF', 'light').fill).toBe('#0b5fff');
    expect(brandShades('#0b5fff', 'light').onFill).toBe('#ffffff');
  });

  it('puts dark text on a light fill', () => {
    expect(brandShades('#ffeb3b', 'dark')).toMatchObject({ fill: '#ffeb3b', onFill: '#000000' });
  });

  it('refuses something that is not a colour', () => {
    expect(() => brandShades('red', 'light')).toThrow(/#RRGGBB/);
  });
});

describe('brandRoles', () => {
  it('replaces nothing when nothing is picked', () => {
    expect(brandRoles({ color: null, accent: null }, 'light')).toEqual({});
  });

  it('replaces the primary roles for a colour, and the accent roles for an accent', () => {
    expect(Object.keys(brandRoles({ color: '#0b5fff', accent: null }, 'light'))).toEqual([
      'primary',
      'primaryHover',
      'onPrimary',
      'primarySoft',
      'primaryFg',
    ]);
    expect(Object.keys(brandRoles({ color: null, accent: '#ff6f00' }, 'dark'))).toEqual([
      'accent',
      'accentHover',
      'onAccent',
      'accentSoft',
      'accentFg',
    ]);
  });
});

describe('brandCss', () => {
  it('is empty when nothing is picked', () => {
    expect(brandCss('.brand', { color: null, accent: null })).toBe('');
  });

  it('sets the theme variables for both themes', () => {
    const css = brandCss('.brand', { color: '#0b5fff', accent: null });
    expect(css).toContain('.brand{--color-primary:#0b5fff;--color-primary-hover:');
    expect(css).toContain('--color-on-primary:#ffffff');
    expect(css).toContain("[data-theme='dark'] .brand{--color-primary:");
    expect(css).toContain(
      "@media (prefers-color-scheme:dark){:root:not([data-theme='light']) .brand{",
    );
    // Only colours and variable names: nothing a stylesheet could be broken out of with.
    expect(css).not.toMatch(/[<>]/);
  });
});
