import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { renderTailwindTheme } from './tailwind';

const themeCssPath = fileURLToPath(new URL('../theme.css', import.meta.url));

describe('renderTailwindTheme', () => {
  const css = renderTailwindTheme();

  it('matches the checked-in theme.css', () => {
    // `pnpm --filter @oathly/tokens build` sets this to rewrite the file.
    if (process.env.UPDATE_THEME_CSS) writeFileSync(themeCssPath, css);
    expect(readFileSync(themeCssPath, 'utf8')).toBe(css);
  });

  it('exposes brand and semantic colours as Tailwind theme variables', () => {
    expect(css).toContain('--color-navy-900: #132244;');
    expect(css).toContain('--color-gold-400: #E8B130;');
    expect(css).toContain('--color-surface-raised: #FFFFFF;');
  });

  it('overrides semantic colours for dark, by attribute and by system setting', () => {
    const dark = css.slice(css.indexOf("[data-theme='dark']"));
    expect(dark).toContain('--color-canvas: #0B1630;');
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(":root:not([data-theme='light'])");
  });

  it('carries the motion tokens and switches them off for reduced motion', () => {
    expect(css).toContain('--transition-duration-fast: 120ms;');
    expect(css).toContain('--transition-duration-base: 200ms;');
    expect(css).toContain('--transition-duration-slow: 320ms;');
    expect(css).toMatch(/--ease-spring-bouncy: linear\(0, /);
    const reduced = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(reduced).toContain('--transition-duration-slow: 0.01ms;');
    expect(reduced).toContain('--transition-duration-spring-bouncy: 0.01ms;');
  });
});
