import {
  colors,
  duration,
  elevations,
  fontFamily,
  palette,
  radii,
  spacing,
  spring,
  springDuration,
  typeScale,
  type ColorRole,
  type DurationName,
  type Elevation,
  type SpringName,
  type ThemeName,
  type TypeScaleStep,
} from '@oathly/tokens';
import type { Metadata } from 'next';

import { LogoLockup, LogoMark, type LogoVariant } from '@/components/brand/logo';

export const metadata: Metadata = {
  title: 'Oathly brand',
  robots: { index: false, follow: false },
};

const themeNames = ['light', 'dark'] as const satisfies readonly ThemeName[];

const candidates: { variant: LogoVariant; name: string; note: string }[] = [
  {
    variant: 'meridian',
    name: 'Meridian',
    note: 'A ring for the O. The meridian starts at the pole, bends near the base and leaves as a check. Both ends tuck under the ring, so the line reads as drawn on the globe.',
  },
  {
    variant: 'seal',
    name: 'Seal',
    note: 'The globe filled in, with the same line cut across it. The heaviest of the three, so it holds up best at 16px.',
  },
  {
    variant: 'orbit',
    name: 'Orbit',
    note: 'An open ring. The check is the only line inside and its tip leaves through the gap. Closest to a plain check mark, furthest from a globe.',
  },
];

const markSizes = [96, 48, 32, 24, 16];

// Tailwind only generates classes it can see written out in full.
const textClass: Record<TypeScaleStep, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
  '5xl': 'text-5xl',
  '6xl': 'text-6xl',
  '7xl': 'text-7xl',
};

const shadowClass: Record<Elevation, string> = {
  xs: 'shadow-xs',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
};

const durationClass: Record<DurationName, string> = {
  fast: 'duration-fast ease-standard',
  base: 'duration-base ease-standard',
  slow: 'duration-slow ease-standard',
};

const springClass: Record<SpringName, string> = {
  gentle: 'duration-spring-gentle ease-spring-gentle',
  snappy: 'duration-spring-snappy ease-spring-snappy',
  bouncy: 'duration-spring-bouncy ease-spring-bouncy',
};

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

function ThemePanel({
  theme,
  children,
  className = '',
}: {
  theme: ThemeName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-theme={theme}
      className={`bg-canvas text-fg border-border rounded-xl border p-6 sm:p-8 ${className}`}
    >
      <p className="text-fg-muted mb-6 text-sm">{theme === 'light' ? 'Light' : 'Dark'}</p>
      {children}
    </div>
  );
}

function Candidate({
  index,
  variant,
  name,
  note,
}: {
  index: number;
  variant: LogoVariant;
  name: string;
  note: string;
}) {
  return (
    <section aria-labelledby={`logo-${variant}`} className="mt-16">
      <h2 id={`logo-${variant}`} className="font-display text-3xl font-semibold">
        Option {index + 1}: {name}
      </h2>
      <p className="text-fg-muted mt-2 max-w-[62ch]">{note}</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {themeNames.map((theme) => (
          <ThemePanel key={theme} theme={theme}>
            <LogoLockup
              variant={variant}
              layout="integrated"
              height={56}
              className="h-auto max-w-full"
            />
            <LogoLockup
              variant={variant}
              layout="symbol"
              height={32}
              className="mt-8 h-auto max-w-full"
            />
            <div className="mt-10 flex flex-wrap items-end gap-x-6 gap-y-4">
              {markSizes.map((size) => (
                <figure key={size} className="flex flex-col items-center gap-2">
                  <LogoMark variant={variant} size={size} />
                  <figcaption className="text-fg-muted text-xs">{size}px</figcaption>
                </figure>
              ))}
              <figure className="ml-auto flex flex-col items-center gap-2">
                {/* Icon tiles keep their own colours whatever the theme around them. */}
                <div
                  data-theme="dark"
                  className="bg-navy-900 border-navy-700 shadow-md flex size-24 items-center justify-center rounded-[22%] border"
                >
                  <LogoMark variant={variant} size={58} />
                </div>
                <figcaption className="text-fg-muted text-xs">App icon</figcaption>
              </figure>
            </div>
          </ThemePanel>
        ))}
      </div>
    </section>
  );
}

function Ramps() {
  const ramps = (['navy', 'gold', 'neutral', 'success', 'error'] as const).map(
    (name) => [name, palette[name]] as const,
  );
  return (
    <div className="mt-6 space-y-3">
      {ramps.map(([name, steps]) => (
        <div key={name} className="flex items-center gap-4">
          <p className="w-20 shrink-0 text-sm font-medium capitalize">{name}</p>
          <ul className="grid flex-1 grid-cols-11 gap-1">
            {Object.entries(steps).map(([step, hex]) => (
              <li key={step}>
                <div
                  className="border-border h-10 rounded-xs border sm:h-12"
                  style={{ backgroundColor: hex }}
                  title={`${name}-${step} ${hex}`}
                />
                <p className="text-fg-muted mt-1 text-center text-xs">{step}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function RoleSwatches({ theme }: { theme: ThemeName }) {
  const roles = colors[theme];
  return (
    <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {(Object.keys(roles) as ColorRole[]).map((role) => (
        <li key={role} className="flex items-center gap-2">
          <span
            className="border-border-strong size-6 shrink-0 rounded-full border"
            style={{ backgroundColor: roles[role] }}
          />
          <span className="text-fg-muted truncate font-mono text-xs">{role}</span>
        </li>
      ))}
    </ul>
  );
}

/** A practice question, to see the colour roles doing their real jobs. */
function Specimen() {
  return (
    <div className="bg-surface border-border shadow-sm rounded-lg border p-5">
      <p className="text-fg-muted text-sm">Question 4 of 20</p>
      <p className="font-display mt-1 text-xl font-medium">What is a constitution?</p>
      <ul className="mt-4 space-y-2">
        <li className="bg-success-soft text-success-fg border-success rounded-md border px-4 py-3">
          The highest law of a country <span className="font-semibold">(correct)</span>
        </li>
        <li className="bg-error-soft text-error-fg border-error rounded-md border px-4 py-3">
          A yearly government budget <span className="font-semibold">(your answer)</span>
        </li>
        <li className="border-border-strong rounded-md border px-4 py-3">
          A list of public holidays
        </li>
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={`bg-primary text-on-primary hover:bg-primary-hover duration-fast rounded-md px-4 py-2.5 font-semibold transition-colors ${focusRing}`}
        >
          Next question
        </button>
        <button
          type="button"
          className={`bg-accent text-on-accent hover:bg-accent-hover duration-fast rounded-md px-4 py-2.5 font-semibold transition-colors ${focusRing}`}
        >
          Explain this answer
        </button>
        <a
          href="#tokens"
          className={`text-primary-fg rounded-xs font-medium underline ${focusRing}`}
        >
          Read the source
        </a>
      </div>
      <p className="bg-accent-soft text-accent-fg mt-5 rounded-md px-4 py-3 text-sm">
        Checked against the official study guide. Oathly is independent and not a government
        service.
      </p>
    </div>
  );
}

function MotionRow({ name, detail, timing }: { name: string; detail: string; timing: string }) {
  return (
    <button
      type="button"
      className={`group hover:bg-surface-sunken flex w-full items-center gap-4 rounded-md px-3 py-2.5 text-left ${focusRing}`}
    >
      <span className="w-36 shrink-0">
        <span className="block font-medium">{name}</span>
        <span className="text-fg-muted block text-sm">{detail}</span>
      </span>
      <span className="border-border relative block h-7 flex-1 rounded-full border">
        <span
          className={`bg-accent absolute top-0.5 left-0.5 block size-5.5 rounded-full transition-[left,translate] group-hover:left-[calc(100%-0.125rem)] group-hover:-translate-x-full group-focus:left-[calc(100%-0.125rem)] group-focus:-translate-x-full ${timing}`}
        />
      </span>
    </button>
  );
}

export default function BrandPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
      <h1 className="font-display text-5xl font-semibold">Oathly brand</h1>
      <p className="text-fg-muted mt-4 max-w-[62ch] text-lg">
        Three logo candidates, each on the light and the dark theme. Pick one and the favicon, app
        icons and splash screen are generated from it. The tokens that style this page are listed
        underneath.
      </p>

      {candidates.map((candidate, index) => (
        <Candidate key={candidate.variant} index={index} {...candidate} />
      ))}

      <section aria-labelledby="tokens" className="mt-24">
        <h2 id="tokens" className="font-display text-3xl font-semibold">
          Tokens
        </h2>
        <p className="text-fg-muted mt-2 max-w-[62ch]">
          Defined once in <code className="font-mono text-sm">packages/tokens</code>, exported to
          Tailwind for the web and as a theme object for mobile.
        </p>

        <h3 className="font-display mt-12 text-2xl font-medium">Colour</h3>
        <Ramps />
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {themeNames.map((theme) => (
            <ThemePanel key={theme} theme={theme}>
              <Specimen />
              <RoleSwatches theme={theme} />
            </ThemePanel>
          ))}
        </div>

        <h3 className="font-display mt-16 text-2xl font-medium">Type</h3>
        <p className="text-fg-muted mt-2 max-w-[62ch]">
          {fontFamily.display.name} for headings, {fontFamily.body.name} for everything else. Both
          were designed for reading ease.
        </p>
        <ul className="mt-6 space-y-4">
          {(Object.keys(typeScale) as TypeScaleStep[]).reverse().map((step) => {
            const { size, lineHeight } = typeScale[step];
            const isDisplay = size >= 24;
            return (
              <li key={step} className="border-border flex items-baseline gap-6 border-b pb-4">
                <span className="text-fg-muted w-24 shrink-0 font-mono text-xs">
                  {step} {size}/{lineHeight}
                </span>
                <span
                  className={`${textClass[step]} min-w-0 truncate ${isDisplay ? 'font-display font-semibold' : ''}`}
                >
                  {isDisplay ? 'Ready for the oath' : 'Study in the language you think in.'}
                </span>
              </li>
            );
          })}
        </ul>

        <h3 className="font-display mt-16 text-2xl font-medium">Spacing</h3>
        <ul className="mt-6 space-y-2">
          {Object.entries(spacing)
            .filter(([, px]) => px > 0)
            .sort(([, a], [, b]) => a - b)
            .map(([step, px]) => (
              <li key={step} className="flex items-center gap-4">
                <span className="text-fg-muted w-24 shrink-0 font-mono text-xs">
                  {step} {px}px
                </span>
                <span className="bg-primary block h-3 rounded-xs" style={{ width: px }} />
              </li>
            ))}
        </ul>

        <h3 className="font-display mt-16 text-2xl font-medium">Radii</h3>
        <ul className="mt-6 flex flex-wrap gap-6">
          {Object.entries(radii).map(([name, px]) => (
            <li key={name} className="text-center">
              <span
                className="bg-primary-soft border-primary block size-20 border-2"
                style={{ borderRadius: px }}
              />
              <span className="text-fg-muted mt-2 block font-mono text-xs">
                {name} {name === 'full' ? '' : `${px}px`}
              </span>
            </li>
          ))}
        </ul>

        <h3 className="font-display mt-16 text-2xl font-medium">Shadows</h3>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {themeNames.map((theme) => (
            <ThemePanel key={theme} theme={theme}>
              <ul className="flex flex-wrap gap-6">
                {elevations.map((elevation) => (
                  <li
                    key={elevation}
                    className={`bg-surface-raised ${shadowClass[elevation]} flex size-20 items-center justify-center rounded-md font-mono text-xs`}
                  >
                    {elevation}
                  </li>
                ))}
              </ul>
            </ThemePanel>
          ))}
        </div>

        <h3 className="font-display mt-16 text-2xl font-medium">Motion</h3>
        <p className="text-fg-muted mt-2 max-w-[62ch]">
          Hover a row, or press it, to play the timing. With reduced motion turned on in your system
          settings the dot jumps instead of travelling.
        </p>
        <div className="mt-6 grid gap-x-8 gap-y-1 lg:grid-cols-2">
          {(Object.keys(duration) as DurationName[]).map((name) => (
            <MotionRow
              key={name}
              name={name}
              detail={`${duration[name]}ms`}
              timing={durationClass[name]}
            />
          ))}
          {(Object.keys(spring) as SpringName[]).map((name) => (
            <MotionRow
              key={name}
              name={`spring ${name}`}
              detail={`settles in ${springDuration(spring[name])}ms`}
              timing={springClass[name]}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
