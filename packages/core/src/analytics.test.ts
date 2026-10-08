import { describe, expect, it } from 'vitest';

import { analyticsEventNames, examResultEvent, platformOf } from './analytics';

describe('analyticsEventNames', () => {
  it('lists the key events once each', () => {
    expect(new Set(analyticsEventNames).size).toBe(analyticsEventNames.length);
    expect(analyticsEventNames).toEqual(
      expect.arrayContaining([
        'signup',
        'first_question_answered',
        'mock_exam_completed',
        'upgrade',
        'pass_reported',
      ]),
    );
  });
});

describe('examResultEvent', () => {
  it('counts a pass and a fail as different events', () => {
    expect(examResultEvent('passed')).toBe('pass_reported');
    expect(examResultEvent('failed')).toBe('fail_reported');
  });
});

describe('platformOf', () => {
  it('takes a bearer token to be the phone app and anything else the website', () => {
    expect(platformOf('Bearer abc')).toBe('mobile');
    expect(platformOf('bearer abc')).toBe('mobile');
    expect(platformOf(null)).toBe('web');
    expect(platformOf(undefined)).toBe('web');
    expect(platformOf('Basic abc')).toBe('web');
  });
});
