import { contrastRatio, parseHex } from './contrast';
import { colors, type ColorRoles, type ThemeName } from './themes';

// White-label: an organization picks a colour (and optionally an accent), and
// these functions turn each into shades that stay readable in both themes.
// Whatever is picked, text keeps WCAG AA contrast: the picked colour is kept
// where it already works, and moved towards black or white where it does not.

/** Text on a surface, and text on a fill. */
const TEXT_CONTRAST = 4.5;
/** A fill that has to be told apart from the surface it sits on. */
const FILL_CONTRAST = 3;

const hex = (channels: readonly number[]) =>
  `#${channels.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;

/** `a` with `weight` (0 to 1) of `b` mixed in. */
export function mixHex(a: string, b: string, weight: number): string {
  const from = parseHex(a);
  const to = parseHex(b);
  return hex(from.map((value, index) => value + (to[index]! - value) * weight));
}

/** `color`, moved towards `target` only as far as `accept` needs. */
function shiftUntil(color: string, target: string, accept: (candidate: string) => boolean): string {
  for (let step = 0; step < 50; step += 1) {
    const candidate = mixHex(color, target, step / 50);
    if (accept(candidate)) return candidate;
  }
  return target;
}

/** The shades one picked colour becomes. */
export interface BrandShades {
  /** A filled control. */
  fill: string;
  fillHover: string;
  /** Text and icons on the fill. */
  onFill: string;
  /** A tinted background. */
  soft: string;
  /** The colour as text or a link on a surface, or on the tint. */
  fg: string;
}

export function brandShades(color: string, theme: ThemeName): BrandShades {
  const roles = colors[theme];
  const base = hex(parseHex(color));
  // The direction that separates a colour from this theme's surfaces.
  const away = theme === 'light' ? '#000000' : '#ffffff';
  const surfaces = [roles.surface, roles.canvas];
  const clears = (candidate: string, backgrounds: readonly string[], ratio: number) =>
    backgrounds.every((background) => contrastRatio(candidate, background) >= ratio);

  const soft = mixHex(roles.surface, base, theme === 'light' ? 0.1 : 0.22);
  const fill = shiftUntil(base, away, (candidate) => clears(candidate, surfaces, FILL_CONTRAST));
  // Black or white: one of the two always reaches 4.5 against any colour.
  const onFill =
    contrastRatio(fill, '#ffffff') >= contrastRatio(fill, '#000000') ? '#ffffff' : '#000000';
  return {
    fill,
    fillHover: mixHex(fill, onFill === '#ffffff' ? '#000000' : '#ffffff', 0.12),
    onFill,
    soft,
    fg: shiftUntil(base, away, (candidate) =>
      clears(candidate, [...surfaces, soft], TEXT_CONTRAST),
    ),
  };
}

/** What an organization has picked. Either may be missing. */
export interface Brand {
  color: string | null;
  accent: string | null;
}

/** The colour roles an organization's brand replaces in a theme. */
export function brandRoles(brand: Brand, theme: ThemeName): Partial<ColorRoles> {
  const roles: Partial<ColorRoles> = {};
  if (brand.color) {
    const shades = brandShades(brand.color, theme);
    roles.primary = shades.fill;
    roles.primaryHover = shades.fillHover;
    roles.onPrimary = shades.onFill;
    roles.primarySoft = shades.soft;
    roles.primaryFg = shades.fg;
  }
  if (brand.accent) {
    const shades = brandShades(brand.accent, theme);
    roles.accent = shades.fill;
    roles.accentHover = shades.fillHover;
    roles.onAccent = shades.onFill;
    roles.accentSoft = shades.soft;
    roles.accentFg = shades.fg;
  }
  return roles;
}

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/**
 * CSS that applies a brand to everything inside `selector`, in whichever
 * theme is showing. Empty when the organization has picked nothing.
 */
export function brandCss(selector: string, brand: Brand): string {
  const block = (theme: ThemeName) =>
    Object.entries(brandRoles(brand, theme))
      .map(([role, value]) => `--color-${kebab(role)}:${value}`)
      .join(';');
  const light = block('light');
  if (!light) return '';
  const dark = block('dark');
  return [
    `${selector}{${light}}`,
    `[data-theme='dark'] ${selector}{${dark}}`,
    `@media (prefers-color-scheme:dark){:root:not([data-theme='light']) ${selector}{${dark}}}`,
  ].join('');
}
