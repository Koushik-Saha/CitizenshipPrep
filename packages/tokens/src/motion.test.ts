import { describe, expect, it } from 'vitest';

import { duration, spring, springDuration, springPosition, springToCss } from './motion';

describe('duration', () => {
  it('is 120 / 200 / 320ms', () => {
    expect(duration).toEqual({ fast: 120, base: 200, slow: 320 });
  });
});

describe('springPosition', () => {
  it.each(Object.entries(spring))('%s starts at 0 and settles at 1', (_name, config) => {
    expect(springPosition(config, 0)).toBeCloseTo(0, 10);
    expect(springPosition(config, 5)).toBeCloseTo(1, 4);
  });

  it('handles critically damped and overdamped springs', () => {
    const critical = { stiffness: 100, damping: 20, mass: 1 };
    const over = { stiffness: 100, damping: 40, mass: 1 };
    for (const config of [critical, over]) {
      expect(springPosition(config, 0)).toBeCloseTo(0, 10);
      expect(springPosition(config, 0.2)).toBeGreaterThan(0);
      expect(springPosition(config, 0.2)).toBeLessThan(1);
      expect(springPosition(config, 10)).toBeCloseTo(1, 4);
    }
  });

  it('only the bouncy preset visibly overshoots', () => {
    const peak = (name: keyof typeof spring) =>
      Math.max(...Array.from({ length: 2000 }, (_, ms) => springPosition(spring[name], ms / 1000)));
    expect(peak('gentle')).toBeLessThan(1.001);
    expect(peak('snappy')).toBeLessThan(1.02);
    expect(peak('bouncy')).toBeGreaterThan(1.1);
  });
});

describe('springToCss', () => {
  it.each(Object.entries(spring))('%s becomes a linear() easing from 0 to 1', (_name, config) => {
    const { duration: ms, easing } = springToCss(config);
    expect(ms).toBe(springDuration(config));
    expect(ms).toBeGreaterThan(100);
    expect(ms).toBeLessThan(1500);
    expect(easing).toMatch(/^linear\(0, .*, 1\)$/);
  });
});
