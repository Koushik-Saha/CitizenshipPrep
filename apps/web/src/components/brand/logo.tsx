import { useId } from 'react';

// Logo candidates, drawn by hand on a 64-unit grid. Colours come from the
// logo-* theme tokens, so each drawing follows the surrounding theme.
// The idea in all three: an "o" that is a globe, whose one meridian runs down
// from the pole and bends into a check mark. In the wordmark it is the o of
// "Swornly", drawn at the letters' x-height.

export const logoVariants = ['meridian', 'seal', 'orbit'] as const;
export type LogoVariant = (typeof logoVariants)[number];

const MARK = 64;
const WORD_HEIGHT = 80; // the y descends 16 units below the baseline
const SYMBOL_GAP = 22;
/** The o, on the letters' x-height: 44 of the 64-unit cap height, sitting on the baseline. */
const O_SIZE = 44;
const O_X = 109.25;
const O_Y = MARK - O_SIZE;
const WORD_WIDTH = 302;
/** The ring's stroke when drawn as the o: the letters' 9, before scaling down to O_SIZE. */
const RING_AS_O = (9 * MARK) / O_SIZE;

interface GlyphProps {
  /** Drawn as the wordmark's o, at x-height. */
  asO?: boolean;
}

/**
 * The ring of the mark. Drawn small, as the wordmark's o, it is drawn heavier
 * (the same outer edge, a thicker stroke) so that once scaled down it matches
 * the weight of the letters beside it; the check is drawn heavier with it.
 */
const ring = (asO: boolean) =>
  asO ? { r: 32 - RING_AS_O / 2, strokeWidth: RING_AS_O } : { r: 27.5, strokeWidth: 9 };

function MeridianGlyph({ asO = false }: GlyphProps) {
  return (
    <>
      {/* Drawn first so both ends tuck under the ring, like a line on the globe's surface. */}
      <path
        d="M32 4C17 13 11 35 26 50L53 12"
        className="stroke-logo-line"
        strokeWidth={asO ? 9.5 : 7}
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" {...ring(asO)} className="stroke-logo-ink" />
    </>
  );
}

function SealGlyph(_: GlyphProps) {
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

function OrbitGlyph({ asO = false }: GlyphProps) {
  const { r, strokeWidth } = ring(asO);
  // The same opening in the ring, whatever its radius.
  const at = (x: number, y: number) =>
    `${32 + ((x - 32) * r) / 27.5} ${32 + ((y - 32) * r) / 27.5}`;
  return (
    <>
      <path
        d={`M${at(44.2, 7.4)}A${r} ${r} 0 1 0 ${at(58.6, 25)}`}
        className="stroke-logo-ink"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M17.5 30Q24 35 28 47.5Q39 26 57 9"
        className="stroke-logo-line"
        strokeWidth={asO ? 9.5 : 7.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

const glyphs: Record<LogoVariant, (props: GlyphProps) => React.ReactNode> = {
  meridian: MeridianGlyph,
  seal: SealGlyph,
  orbit: OrbitGlyph,
};

/**
 * The letters S-w-r-n-l-y, with `o` drawn in the o's place: one stroke weight,
 * circular bowls, x-height 44 of 64. The S is two stacked circles' arcs.
 */
function Swornly({ o }: { o: React.ReactNode }) {
  return (
    <>
      <g
        className="stroke-logo-ink"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M31.26 10.36A13.75 13.75 0 1 0 20 32A13.75 13.75 0 1 1 8.74 53.64" />
        <path d="M51.75 24.5L62.75 59.5L73.75 32L84.75 59.5L95.75 24.5" />
        <path d="M166.75 24.5V59.5" />
        <path d="M166.75 38a13.5 13.5 0 0 1 13.5-13.5h4" />
        <path d="M202.75 24.5V59.5" />
        <path d="M202.75 39a14.5 14.5 0 0 1 29 0V59.5" />
        <path d="M249.75 4.5V59.5" />
        <path d="M267.75 24.5V45a14.5 14.5 0 0 0 29 0" />
        <path d="M296.75 24.5V64.5a11 11 0 0 1-11 11h-6" />
      </g>
      {o}
    </>
  );
}

/** The mark, made the size of a lowercase o and set in the o's place. */
function MarkAsO({ variant }: { variant: LogoVariant }) {
  const Glyph = glyphs[variant];
  return (
    <g transform={`translate(${O_X} ${O_Y}) scale(${O_SIZE / MARK})`}>
      <Glyph asO />
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
   * `integrated`: the mark stands in for the o of the wordmark.
   * `symbol`: the mark sits beside the full word.
   */
  layout: 'integrated' | 'symbol';
  /** Rendered cap height in px; the y descender adds a quarter more below. */
  height: number;
  className?: string;
}

/** The symbol with the "Swornly" wordmark. */
export function LogoLockup({ variant, layout, height, className }: LockupProps) {
  const Glyph = glyphs[variant];
  const wordStart = layout === 'integrated' ? 0 : MARK + SYMBOL_GAP;
  const width = wordStart + WORD_WIDTH;
  const scale = height / MARK;
  return (
    <svg
      viewBox={`0 0 ${width} ${WORD_HEIGHT}`}
      width={width * scale}
      height={WORD_HEIGHT * scale}
      fill="none"
      role="img"
      aria-label="Swornly"
      className={className}
    >
      {layout === 'symbol' && <Glyph />}
      <g transform={`translate(${wordStart} 0)`}>
        <Swornly
          o={
            layout === 'integrated' ? (
              <MarkAsO variant={variant} />
            ) : (
              <circle
                cx={O_X + O_SIZE / 2}
                cy={O_Y + O_SIZE / 2}
                r="17.5"
                className="stroke-logo-ink"
                strokeWidth="9"
              />
            )
          }
        />
      </g>
    </svg>
  );
}
