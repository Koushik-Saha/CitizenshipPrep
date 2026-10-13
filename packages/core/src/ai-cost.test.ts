import { describe, expect, it } from 'vitest';

import { aiCostUsd, capStatus, totalAiCostUsd } from './ai-cost';

const none = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

describe('what AI use costs', () => {
  it('prices input, output and the prompt cache at the model’s list price', () => {
    const model = 'claude-haiku-4-5';
    expect(aiCostUsd({ ...none, model, input: 1_000_000 })).toBeCloseTo(1);
    expect(aiCostUsd({ ...none, model, output: 1_000_000 })).toBeCloseTo(5);
    expect(aiCostUsd({ ...none, model, cacheWrite: 1_000_000 })).toBeCloseTo(1.25);
    expect(aiCostUsd({ ...none, model, cacheRead: 1_000_000 })).toBeCloseTo(0.1);
    // A typical explanation: 1,200 tokens in, 300 out.
    expect(aiCostUsd({ ...none, model, input: 1200, output: 300 })).toBeCloseTo(0.0027);
    expect(aiCostUsd({ ...none, model })).toBe(0);
  });

  it('knows a dated name for the same model', () => {
    expect(
      aiCostUsd({ ...none, model: 'claude-haiku-4-5-20251001', input: 2_000_000 }),
    ).toBeCloseTo(2);
  });

  it('prices the second model, Gemini, at its own list price', () => {
    const model = 'gemini-3.5-flash-lite';
    expect(aiCostUsd({ ...none, model, input: 1_000_000 })).toBeCloseTo(0.3);
    expect(aiCostUsd({ ...none, model, output: 1_000_000 })).toBeCloseTo(2.5);
    expect(aiCostUsd({ ...none, model, cacheRead: 1_000_000 })).toBeCloseTo(0.03);
  });

  it('gives no figure for a model it has no price for', () => {
    expect(aiCostUsd({ ...none, model: 'some-other-model', input: 1_000_000 })).toBeNull();
  });

  it('adds lots together, and says how many it could not price', () => {
    expect(
      totalAiCostUsd([
        { ...none, model: 'claude-haiku-4-5', input: 1_000_000 },
        { ...none, model: 'claude-haiku-4-5', output: 1_000_000 },
        { ...none, model: 'some-other-model', input: 1_000_000 },
      ]),
    ).toEqual({ usd: 6, unpriced: 1 });
    expect(totalAiCostUsd([])).toEqual({ usd: 0, unpriced: 0 });
  });
});

describe('where use stands against a limit', () => {
  it('is reached at the limit, and near it from four fifths', () => {
    expect(capStatus(0, 20)).toBe('ok');
    expect(capStatus(15, 20)).toBe('ok');
    expect(capStatus(16, 20)).toBe('near');
    expect(capStatus(19, 20)).toBe('near');
    expect(capStatus(20, 20)).toBe('reached');
    expect(capStatus(25, 20)).toBe('reached');
    // Rounded up: 4 of 5 is four fifths, 12 of 15 is too.
    expect(capStatus(11, 15)).toBe('ok');
    expect(capStatus(12, 15)).toBe('near');
  });

  it('is reached at once when the limit is nothing', () => {
    expect(capStatus(0, 0)).toBe('reached');
  });
});
