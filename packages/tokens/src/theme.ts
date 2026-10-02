import { palette } from './colors';
import { radii, spacing } from './layout';
import { duration, easing, spring } from './motion';
import { elevations, shadows, toBoxShadow, type Elevation } from './shadows';
import { colors, type ColorRoles, type ThemeName } from './themes';
import { fontFamily, fontWeight, typeScale, type TypeScaleStep } from './typography';

// The theme object for React Native: everything is a plain number or string
// that can go straight into a style.

export interface TextStyle {
  fontSize: number;
  lineHeight: number;
  /** In px, as React Native expects. */
  letterSpacing: number;
}

export interface Theme {
  name: ThemeName;
  isDark: boolean;
  colors: ColorRoles;
  palette: typeof palette;
  spacing: typeof spacing;
  radii: typeof radii;
  /** Font family names. The app is responsible for loading the files. */
  fonts: { display: string; body: string; mono: string };
  fontWeight: typeof fontWeight;
  text: Record<TypeScaleStep, TextStyle>;
  /** Values for the `boxShadow` style prop. */
  shadows: Record<Elevation, string>;
  motion: {
    duration: typeof duration;
    easing: typeof easing;
    spring: typeof spring;
  };
}

function textStyles(): Record<TypeScaleStep, TextStyle> {
  const entries = (Object.keys(typeScale) as TypeScaleStep[]).map((step) => {
    const { size, lineHeight, letterSpacing } = typeScale[step];
    return [
      step,
      { fontSize: size, lineHeight, letterSpacing: Number((letterSpacing * size).toFixed(2)) },
    ] as const;
  });
  return Object.fromEntries(entries) as Record<TypeScaleStep, TextStyle>;
}

function boxShadows(theme: ThemeName): Record<Elevation, string> {
  const entries = elevations.map(
    (elevation) => [elevation, toBoxShadow(shadows[theme][elevation])] as const,
  );
  return Object.fromEntries(entries) as Record<Elevation, string>;
}

function createTheme(name: ThemeName): Theme {
  return {
    name,
    isDark: name === 'dark',
    colors: colors[name],
    palette,
    spacing,
    radii,
    fonts: {
      display: fontFamily.display.name,
      body: fontFamily.body.name,
      mono: fontFamily.mono.name,
    },
    fontWeight,
    text: textStyles(),
    shadows: boxShadows(name),
    motion: { duration, easing, spring },
  };
}

export const lightTheme: Theme = createTheme('light');
export const darkTheme: Theme = createTheme('dark');
export const themes: Record<ThemeName, Theme> = { light: lightTheme, dark: darkTheme };

/** Picks a theme from React Native's `useColorScheme()` result; anything but 'dark' is light. */
export function themeFor(scheme: string | null | undefined): Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}
