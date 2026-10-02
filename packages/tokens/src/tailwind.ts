import { palette } from './colors';
import { radii, spacingUnit } from './layout';
import { duration, easing, spring, springToCss } from './motion';
import { elevations, shadows, toBoxShadow } from './shadows';
import { colors, type ColorRoles, type ThemeName } from './themes';
import { fontFamily, fontVariable, fontWeight, typeScale, type FontFamilyName } from './typography';

// Renders the tokens as a Tailwind v4 theme. The output is checked in as
// ../theme.css (see tailwind.test.ts) because Tailwind reads CSS, not TS.

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const rem = (px: number) => (px === 0 ? '0' : `${px / 16}rem`);
const decl = (name: string, value: string | number) => `${name}: ${value};`;

function fontStack(name: FontFamilyName): string {
  const family = fontFamily[name];
  const quoted = (value: string) => (value.includes(' ') ? `'${value}'` : value);
  return [`var(${fontVariable[name]}, '${family.name}')`, ...family.fallback.map(quoted)].join(
    ', ',
  );
}

function paletteDecls(): string[] {
  const lines = [decl('--color-white', palette.white), decl('--color-black', palette.black)];
  for (const [ramp, steps] of Object.entries(palette)) {
    if (typeof steps === 'string') continue;
    for (const [step, value] of Object.entries(steps)) {
      lines.push(decl(`--color-${ramp}-${step}`, value));
    }
  }
  return lines;
}

function roleDecls(theme: ThemeName): string[] {
  const roles = colors[theme];
  const lines = (Object.keys(roles) as (keyof ColorRoles)[]).map((role) =>
    decl(`--color-${kebab(role)}`, roles[role]),
  );
  for (const elevation of elevations) {
    lines.push(decl(`--shadow-${elevation}`, toBoxShadow(shadows[theme][elevation])));
  }
  return lines;
}

function typeDecls(): string[] {
  const lines = [
    decl('--font-sans', fontStack('body')),
    decl('--font-display', fontStack('display')),
    decl('--font-mono', fontStack('mono')),
  ];
  for (const [name, weight] of Object.entries(fontWeight)) {
    lines.push(decl(`--font-weight-${name}`, weight));
  }
  for (const [step, { size, lineHeight, letterSpacing }] of Object.entries(typeScale)) {
    lines.push(decl(`--text-${step}`, rem(size)));
    lines.push(decl(`--text-${step}--line-height`, `calc(${lineHeight} / ${size})`));
    lines.push(decl(`--text-${step}--letter-spacing`, `${letterSpacing}em`));
  }
  return lines;
}

function motionDecls(): string[] {
  const lines: string[] = [];
  for (const [name, ms] of Object.entries(duration)) {
    lines.push(decl(`--transition-duration-${name}`, `${ms}ms`));
  }
  for (const [name, curve] of Object.entries(easing)) {
    lines.push(decl(`--ease-${name}`, `cubic-bezier(${curve.join(', ')})`));
  }
  for (const [name, config] of Object.entries(spring)) {
    const css = springToCss(config);
    lines.push(decl(`--transition-duration-spring-${name}`, `${css.duration}ms`));
    lines.push(decl(`--ease-spring-${name}`, css.easing));
  }
  lines.push(decl('--default-transition-duration', `${duration.base}ms`));
  lines.push(decl('--default-transition-timing-function', 'var(--ease-standard)'));
  return lines;
}

function durationNames(): string[] {
  return [...Object.keys(duration), ...Object.keys(spring).map((name) => `spring-${name}`)];
}

function block(selector: string, lines: string[], indent = ''): string {
  const body = lines.map((line) => (line ? `${indent}  ${line}` : ''));
  return [`${indent}${selector} {`, ...body, `${indent}}`].join('\n');
}

export function renderTailwindTheme(): string {
  const theme = [
    '/* Replace Tailwind’s defaults so only brand tokens are available. */',
    decl('--color-*', 'initial'),
    decl('--text-*', 'initial'),
    decl('--radius-*', 'initial'),
    decl('--shadow-*', 'initial'),
    decl('--ease-*', 'initial'),
    '',
    '/* Colour ramps */',
    ...paletteDecls(),
    '',
    '/* Semantic colours and shadows: light values, overridden below for dark */',
    ...roleDecls('light'),
    '',
    '/* Type */',
    ...typeDecls(),
    '',
    '/* Spacing and radii */',
    decl('--spacing', rem(spacingUnit)),
    ...Object.entries(radii).map(([name, px]) =>
      decl(`--radius-${name}`, name === 'full' ? `${px}px` : rem(px)),
    ),
    '',
    '/* Motion */',
    ...motionDecls(),
  ];

  const dark = [decl('color-scheme', 'dark'), ...roleDecls('dark')];

  return [
    '/*',
    ' * Oathly design tokens for Tailwind CSS v4.',
    ' * Generated from packages/tokens/src. Do not edit: run',
    ' * `pnpm --filter @oathly/tokens build` after changing a token.',
    ' *',
    ' * Theme follows the system setting. Put data-theme="light" or',
    ' * data-theme="dark" on any element to force one for that subtree.',
    ' */',
    '',
    block('@theme', theme),
    '',
    block(':root', [decl('color-scheme', 'light')]),
    '',
    block("[data-theme='light']", [decl('color-scheme', 'light'), ...roleDecls('light')]),
    '',
    block("[data-theme='dark']", dark),
    '',
    '@media (prefers-color-scheme: dark) {',
    block(":root:not([data-theme='light'])", dark, '  '),
    '}',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    block(
      ':root',
      [
        ...durationNames().map((name) => decl(`--transition-duration-${name}`, '0.01ms')),
        decl('--default-transition-duration', '0.01ms'),
      ],
      '  ',
    ),
    '}',
    '',
  ].join('\n');
}
