import { describe, expect, it } from 'vitest';

import { hello } from './hello';

describe('hello', () => {
  it('returns the shared greeting', () => {
    expect(hello()).toBe('Hello from @oathly/core');
  });
});
