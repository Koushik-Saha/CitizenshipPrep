/** Durations in ms. */
export const duration = {
  /** Hover, press, small state changes. */
  fast: 120,
  /** The default for most transitions. */
  base: 200,
  /** Larger surfaces entering or leaving: sheets, dialogs. */
  slow: 320,
} as const;

export type DurationName = keyof typeof duration;

export type CubicBezier = readonly [number, number, number, number];

export const easing = {
  /** Things that move and stay on screen. */
  standard: [0.2, 0, 0, 1],
  /** Things arriving. */
  enter: [0, 0, 0.2, 1],
  /** Things leaving. */
  exit: [0.4, 0, 1, 1],
} as const satisfies Record<string, CubicBezier>;

export type EasingName = keyof typeof easing;

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

/** Physical spring presets; pass straight to Reanimated's `withSpring`. */
export const spring = {
  /** No overshoot. Layout shifts, progress, anything informational. */
  gentle: { stiffness: 170, damping: 26, mass: 1 },
  /** Quick with a barely visible settle. Buttons, toggles, selection. */
  snappy: { stiffness: 380, damping: 32, mass: 1 },
  /** Visible overshoot. Reserve for rewards: a correct answer, a streak. */
  bouncy: { stiffness: 260, damping: 14, mass: 1 },
} as const satisfies Record<string, SpringConfig>;

export type SpringName = keyof typeof spring;

/** Position of a spring released from 0 toward 1 with no initial velocity, at `t` seconds. */
export function springPosition({ stiffness, damping, mass }: SpringConfig, t: number): number {
  const omega = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const omegaD = omega * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega * t);
    return 1 - envelope * (Math.cos(omegaD * t) + ((zeta * omega) / omegaD) * Math.sin(omegaD * t));
  }
  if (zeta === 1) {
    return 1 - Math.exp(-omega * t) * (1 + omega * t);
  }
  const root = Math.sqrt(zeta * zeta - 1);
  const fast = -omega * (zeta + root);
  const slow = -omega * (zeta - root);
  return 1 - (fast * Math.exp(slow * t) - slow * Math.exp(fast * t)) / (fast - slow);
}

/** Time in ms after which the spring stays within `tolerance` of its target. */
export function springDuration(config: SpringConfig, tolerance = 0.002): number {
  const stepMs = 1;
  const limitMs = 5000;
  let settled = 0;
  for (let ms = 0; ms <= limitMs; ms += stepMs) {
    if (Math.abs(1 - springPosition(config, ms / 1000)) > tolerance) settled = ms + stepMs;
  }
  return Math.ceil(settled / 10) * 10;
}

/**
 * The spring as a CSS `linear()` easing plus the duration it must be paired
 * with, so web transitions follow the same curve Reanimated produces on mobile.
 */
export function springToCss(
  config: SpringConfig,
  points = 32,
): { duration: number; easing: string } {
  const total = springDuration(config);
  const stops: string[] = [];
  for (let i = 0; i <= points; i += 1) {
    const value = i === points ? 1 : springPosition(config, ((i / points) * total) / 1000);
    stops.push(String(Number(value.toFixed(3))));
  }
  return { duration: total, easing: `linear(${stops.join(', ')})` };
}
