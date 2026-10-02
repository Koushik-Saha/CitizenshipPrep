// Primitive colour ramps. UI code should reach for the semantic roles in
// themes.ts; these exist so the roles (and the logo) have something to point at.

export const palette = {
  white: '#FFFFFF',
  black: '#000000',
  /** Deep navy. 900 is the brand colour. */
  navy: {
    50: '#F2F5FB',
    100: '#E1E8F5',
    200: '#C3D0EA',
    300: '#9AB0DA',
    400: '#6B89C4',
    500: '#4667AB',
    600: '#33508F',
    700: '#284074',
    800: '#1C2F59',
    900: '#132244',
    950: '#0B1630',
  },
  /** Warm gold. 400 is the brand accent. */
  gold: {
    50: '#FDF8EA',
    100: '#FAEEC8',
    200: '#F5DC8F',
    300: '#EFC757',
    400: '#E8B130',
    500: '#D99A1B',
    600: '#B87A12',
    700: '#935C12',
    800: '#794A16',
    900: '#663E18',
    950: '#3A2009',
  },
  /** Greys leaning toward the navy hue so they sit quietly next to it. */
  neutral: {
    50: '#F6F7FA',
    100: '#ECEEF3',
    200: '#DADEE7',
    300: '#BDC3D1',
    400: '#939BAE',
    500: '#646D83',
    600: '#515A6E',
    700: '#3D4557',
    800: '#282E3D',
    900: '#181D29',
    950: '#0E121B',
  },
  success: {
    50: '#EAF7F0',
    100: '#CDEBDB',
    200: '#A0D9BC',
    300: '#6CC79B',
    400: '#3DAE7B',
    500: '#23945F',
    600: '#18784B',
    700: '#145F3D',
    800: '#114B31',
    900: '#0E3D29',
    950: '#062217',
  },
  error: {
    50: '#FDF0EE',
    100: '#FAD9D5',
    200: '#F5B8B0',
    300: '#F0958B',
    400: '#E56A5C',
    500: '#D64536',
    600: '#B8322A',
    700: '#962720',
    800: '#7A211C',
    900: '#5C1813',
    950: '#330B08',
  },
} as const;

export type Palette = typeof palette;
