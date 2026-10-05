import { describe, expect, it } from 'vitest';

import { byteRange, clipId } from './audio';

describe('clipId', () => {
  it('names a clip by its language and words', () => {
    expect(clipId('en', 'Yes')).toMatch(/^[0-9a-f]{64}$/);
    expect(clipId('en', 'Yes')).toBe(clipId('en', 'Yes'));
    expect(clipId('en', 'Yes')).not.toBe(clipId('en', 'yes'));
    expect(clipId('en', 'No')).not.toBe(clipId('es', 'No'));
  });
});

describe('byteRange', () => {
  it('reads the three forms of a single range', () => {
    expect(byteRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(byteRange('bytes=100-', 1000)).toEqual({ start: 100, end: 999 });
    expect(byteRange('bytes=-50', 1000)).toEqual({ start: 950, end: 999 });
    // Safari's opening probe.
    expect(byteRange(' bytes=0-1 ', 1000)).toEqual({ start: 0, end: 1 });
  });

  it('stops at the end of the file', () => {
    expect(byteRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
    expect(byteRange('bytes=-5000', 1000)).toEqual({ start: 0, end: 999 });
  });

  it('refuses ranges outside the file', () => {
    expect(byteRange('bytes=1000-', 1000)).toBe('unsatisfiable');
    expect(byteRange('bytes=500-100', 1000)).toBe('unsatisfiable');
    expect(byteRange('bytes=-0', 1000)).toBe('unsatisfiable');
  });

  it('sends everything when there is no usable range', () => {
    expect(byteRange(null, 1000)).toBeNull();
    expect(byteRange('', 1000)).toBeNull();
    expect(byteRange('bytes=-', 1000)).toBeNull();
    expect(byteRange('bytes=0-1,5-9', 1000)).toBeNull();
    expect(byteRange('lines=1-2', 1000)).toBeNull();
  });
});
