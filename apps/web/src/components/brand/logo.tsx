import { useId } from 'react';

// Logo candidates, drawn by hand on a 64-unit grid. Colours come from the
// logo-* theme tokens, so each drawing follows the surrounding theme.
// The idea in all three: an "O" that is a globe, whose one meridian runs down
// from the pole and bends into a check mark.

export const logoVariants = ['meridian', 'seal', 'orbit'] as const;
export type LogoVariant = (typeof logoVariants)[number];

const MARK = 64;
const WORD_HEIGHT = 80; // the y descends 16 units below the baseline
const LETTER_GAP = 9;
const SYMBOL_GAP = 22;
const ATHLY_WIDTH = 194;
const O_ADVANCE = MARK + LETTER_GAP;

function MeridianGlyph() {
  return (
    <>
      {/* Drawn first so both ends tuck under the ring, like a line on the globe's surface. */}
      <path
        d="M32 4C17 13 11 35 26 50L53 12"
        className="stroke-logo-line"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="27.5" className="stroke-logo-ink" strokeWidth="9" />
    </>
  );
}

function SealGlyph() {
  const clipId = useId();
  return (
    <>
      <clipPath id={clipId}>
        <circle cx="32" cy="32" r="32" />
      </clipPath>
      <circle cx="32" cy="32" r="32" className="fill-logo-seal" />
      <path
        d="M32 -2C14 10 8 36 25 52L56 6"
        clipPath={`url(#${clipId})`}
        className="stroke-on-logo-seal"
        strokeWidth="7.5"
        strokeLinejoin="round"
      />
    </>
  );
}

function OrbitGlyph() {
  return (
    <>
      <path
        d="M44.2 7.4A27.5 27.5 0 1 0 58.6 25"
        className="stroke-logo-ink"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M17.5 30Q24 35 28 47.5Q39 26 57 9"
        className="stroke-logo-line"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

const glyphs: Record<LogoVariant, () => React.ReactNode> = {
  meridian: MeridianGlyph,
  seal: SealGlyph,
  orbit: OrbitGlyph,
};

/** The letters a-t-h-l-y: one stroke weight, circular bowls, x-height 44 of 64. */
function Athly() {
  return (
    <g
      className="stroke-logo-ink"
      strokeWidth="9"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <circle cx="22" cy="42" r="17.5" />
      <path d="M39.5 24.5V59.5" />
      <path d="M63.5 10V49.5a10 10 0 0 0 10 10h3" />
      <path d="M57.5 24.5H77.5" />
      <path d="M95.5 4.5V59.5" />
      <path d="M95.5 39a14.5 14.5 0 0 1 29 0V59.5" />
      <path d="M142.5 4.5V59.5" />
      <path d="M160.5 24.5V45a14.5 14.5 0 0 0 29 0" />
      <path d="M189.5 24.5V64.5a11 11 0 0 1-11 11h-6" />
    </g>
  );
}

interface MarkProps {
  variant: LogoVariant;
  /** Rendered width and height in px. */
  size: number;
  /** Accessible name. Leave out when the mark sits next to text that already names it. */
  label?: string;
  className?: string;
}

/** The symbol on its own. */
export function LogoMark({ variant, size, label, className }: MarkProps) {
  const Glyph = glyphs[variant];
  return (
    <svg
      viewBox={`0 0 ${MARK} ${MARK}`}
      width={size}
      height={size}
      fill="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
    >
      <Glyph />
    </svg>
  );
}

interface LockupProps {
  variant: LogoVariant;
  /**
   * `integrated`: the mark stands in for the O of the wordmark.
   * `symbol`: the mark sits beside the full word.
   */
  layout: 'integrated' | 'symbol';
  /** Rendered cap height in px; the y descender adds a quarter more below. */
  height: number;
  className?: string;
}

/** The symbol with the "Oathly" wordmark. */
export function LogoLockup({ variant, layout, height, className }: LockupProps) {
  const Glyph = glyphs[variant];
  const wordStart = layout === 'integrated' ? O_ADVANCE : MARK + SYMBOL_GAP + O_ADVANCE;
  const width = wordStart + ATHLY_WIDTH;
  const scale = height / MARK;
  return (
    <svg
      viewBox={`0 0 ${width} ${WORD_HEIGHT}`}
      width={width * scale}
      height={WORD_HEIGHT * scale}
      fill="none"
      role="img"
      aria-label="Oathly"
      className={className}
    >
      <Glyph />
      {layout === 'symbol' && (
        <circle
          cx={MARK + SYMBOL_GAP + 32}
          cy="32"
          r="27.5"
          className="stroke-logo-ink"
          strokeWidth="9"
        />
      )}
      <g transform={`translate(${wordStart} 0)`}>
        <Athly />
      </g>
    </svg>
  );
}
