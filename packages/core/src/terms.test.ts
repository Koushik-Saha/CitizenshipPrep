import { describe, expect, it } from 'vitest';

import { MINIMUM_AGE, mustAcceptTerms, TERMS_VERSION } from './terms';

describe('accepting the terms', () => {
  it('is asked of someone who never has, and not again of someone who has', () => {
    expect(mustAcceptTerms(null)).toBe(true);
    expect(mustAcceptTerms(undefined)).toBe(true);
    expect(mustAcceptTerms('2026-10-13T09:00:00.000Z')).toBe(false);
    expect(mustAcceptTerms(new Date('2026-10-13T09:00:00Z'))).toBe(false);
  });

  it('names the version by its date, and the age the terms give', () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(MINIMUM_AGE).toBe(16);
  });
});
