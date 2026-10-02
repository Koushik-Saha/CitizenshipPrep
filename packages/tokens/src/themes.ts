import { palette } from './colors';
import { withAlpha } from './contrast';

/**
 * Semantic colour roles. Every role exists in both themes, so UI code never
 * needs to know which one is active.
 *
 * Naming: `x` is a fill, `onX` is text or icons placed on that fill, `xSoft`
 * is a tinted background, and `xFg` is that hue used as text on a surface.
 */
export interface ColorRoles {
  /** Page background. */
  canvas: string;
  /** Cards, sheets, inputs. */
  surface: string;
  /** Surfaces that float above others: menus, popovers. */
  surfaceRaised: string;
  /** Wells and inset areas. */
  surfaceSunken: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  /** Decorative dividers. */
  border: string;
  /** Boundaries that carry meaning (inputs, unselected controls): 3:1 on surfaces. */
  borderStrong: string;
  primary: string;
  primaryHover: string;
  onPrimary: string;
  primarySoft: string;
  primaryFg: string;
  accent: string;
  accentHover: string;
  onAccent: string;
  accentSoft: string;
  accentFg: string;
  success: string;
  onSuccess: string;
  successSoft: string;
  successFg: string;
  error: string;
  onError: string;
  errorSoft: string;
  errorFg: string;
  focusRing: string;
  /** Scrim behind modals. */
  overlay: string;
  /** Logo: the ring and the wordmark. */
  logoInk: string;
  /** Logo: the meridian that turns into the check. */
  logoLine: string;
  /** Logo: the filled globe of the solid mark, and the line cut into it. */
  logoSeal: string;
  onLogoSeal: string;
}

export type ColorRole = keyof ColorRoles;
export type ThemeName = 'light' | 'dark';

const { navy, gold, neutral, success, error, white } = palette;

export const lightColors: ColorRoles = {
  canvas: neutral[50],
  surface: white,
  surfaceRaised: white,
  surfaceSunken: neutral[100],
  fg: navy[950],
  fgMuted: neutral[600],
  fgSubtle: neutral[500],
  border: neutral[200],
  borderStrong: neutral[500],
  primary: navy[800],
  primaryHover: navy[900],
  onPrimary: white,
  primarySoft: navy[100],
  primaryFg: navy[700],
  accent: gold[400],
  accentHover: gold[500],
  onAccent: navy[950],
  accentSoft: gold[100],
  accentFg: gold[700],
  success: success[600],
  onSuccess: white,
  successSoft: success[50],
  successFg: success[700],
  error: error[600],
  onError: white,
  errorSoft: error[50],
  errorFg: error[700],
  focusRing: navy[600],
  overlay: withAlpha(navy[950], 0.56),
  logoInk: navy[900],
  logoLine: gold[400],
  logoSeal: navy[900],
  onLogoSeal: gold[400],
};

export const darkColors: ColorRoles = {
  canvas: navy[950],
  surface: navy[900],
  surfaceRaised: navy[800],
  surfaceSunken: '#070F22',
  fg: neutral[50],
  fgMuted: navy[200],
  fgSubtle: navy[300],
  border: navy[700],
  borderStrong: navy[400],
  primary: navy[200],
  primaryHover: navy[100],
  onPrimary: navy[950],
  primarySoft: navy[800],
  primaryFg: navy[200],
  accent: gold[400],
  accentHover: gold[300],
  onAccent: navy[950],
  accentSoft: gold[950],
  accentFg: gold[300],
  success: success[300],
  onSuccess: success[950],
  successSoft: success[950],
  successFg: success[300],
  error: error[300],
  onError: error[950],
  errorSoft: error[950],
  errorFg: error[300],
  focusRing: gold[300],
  overlay: withAlpha('#000000', 0.64),
  logoInk: neutral[50],
  logoLine: gold[400],
  logoSeal: gold[400],
  onLogoSeal: navy[950],
};

export const colors: Record<ThemeName, ColorRoles> = { light: lightColors, dark: darkColors };
