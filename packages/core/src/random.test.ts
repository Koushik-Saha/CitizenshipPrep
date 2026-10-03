import { describe, expect, it } from 'vitest';

import { createRandom, shuffle } from './random';

describe('createRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(createRandom(43)()).not.toBe(first[0]);
  });

  it('stays within [0, 1)', () => {
    const random = createRandom(7);
    for (let i = 0; i < 10_000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('shuffle', () => {
  it('keeps every item, reorders them reproducibly, and leaves the input alone', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const shuffled = shuffle(items, createRandom(1));
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).not.toEqual(items);
    expect(shuffle(items, createRandom(1))).toEqual(shuffled);
    expect(items[0]).toBe(0);
  });

  it('handles empty and single-item lists', () => {
    expect(shuffle([], createRandom(1))).toEqual([]);
    expect(shuffle(['only'], createRandom(1))).toEqual(['only']);
  });
});
