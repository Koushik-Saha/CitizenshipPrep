import { palette } from './colors';
import { withAlpha } from './contrast';
import type { ThemeName } from './themes';

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

export const elevations = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export type Elevation = (typeof elevations)[number];

// [y, blur, spread, alpha] per layer. Each elevation pairs a tight contact
// shadow with a wider ambient one.
const geometry: Record<Elevation, readonly (readonly [number, number, number, number])[]> = {
  xs: [[1, 2, 0, 0.06]],
  sm: [
    [1, 2, 0, 0.06],
    [2, 6, -1, 0.08],
  ],
  md: [
    [2, 4, -1, 0.06],
    [6, 16, -2, 0.1],
  ],
  lg: [
    [4, 8, -2, 0.06],
    [14, 32, -4, 0.14],
  ],
  xl: [
    [8, 16, -4, 0.08],
    [28, 64, -8, 0.2],
  ],
};

// Light shadows are tinted navy rather than grey; on dark surfaces only a much
// stronger black reads at all.
const tint: Record<ThemeName, { color: string; strength: number }> = {
  light: { color: palette.navy[950], strength: 1 },
  dark: { color: palette.black, strength: 3.5 },
};

function layersFor(theme: ThemeName, elevation: Elevation): ShadowLayer[] {
  const { color, strength } = tint[theme];
  return geometry[elevation].map(([y, blur, spread, alpha]) => ({
    x: 0,
    y,
    blur,
    spread,
    color: withAlpha(color, Math.min(1, Number((alpha * strength).toFixed(2)))),
  }));
}

function shadowsFor(theme: ThemeName): Record<Elevation, ShadowLayer[]> {
  return {
    xs: layersFor(theme, 'xs'),
    sm: layersFor(theme, 'sm'),
    md: layersFor(theme, 'md'),
    lg: layersFor(theme, 'lg'),
    xl: layersFor(theme, 'xl'),
  };
}

export const shadows: Record<ThemeName, Record<Elevation, ShadowLayer[]>> = {
  light: shadowsFor('light'),
  dark: shadowsFor('dark'),
};

/** `box-shadow` value, valid in CSS and in React Native's `boxShadow` style. */
export function toBoxShadow(layers: readonly ShadowLayer[]): string {
  return layers
    .map(({ x, y, blur, spread, color }) => `${x}px ${y}px ${blur}px ${spread}px ${color}`)
    .join(', ');
}
