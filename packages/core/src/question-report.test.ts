import { describe, expect, it } from 'vitest';

import { parseQuestionReport, REPORT_DETAILS_MAX, questionReportReasons } from './question-report';

describe('a report of a problem with a question', () => {
  it('offers the four things a learner can say is wrong', () => {
    expect(questionReportReasons).toEqual(['incorrect', 'outdated', 'unclear', 'typo']);
  });

  it('is kept when it names one of them', () => {
    expect(parseQuestionReport({ reason: 'incorrect' })).toEqual({
      reason: 'incorrect',
      details: null,
      locale: null,
    });
    expect(
      parseQuestionReport({ reason: 'typo', details: '  "teh" in option b  ', locale: 'es' }),
    ).toEqual({ reason: 'typo', details: '"teh" in option b', locale: 'es' });
    expect(parseQuestionReport({ reason: 'outdated', locale: 'zh-Hans' })!.locale).toBe('zh-Hans');
  });

  it('is refused when it names no reason we offer', () => {
    expect(parseQuestionReport({ reason: 'other' })).toBeNull();
    expect(parseQuestionReport({ reason: 'translation' })).toBeNull();
    expect(parseQuestionReport({ reason: 7 })).toBeNull();
    expect(parseQuestionReport({})).toBeNull();
    expect(parseQuestionReport(null)).toBeNull();
    expect(parseQuestionReport('incorrect')).toBeNull();
  });

  it('keeps a long note to length, and drops an empty one', () => {
    const long = parseQuestionReport({ reason: 'unclear', details: 'x'.repeat(2000) })!;
    expect(long.details).toHaveLength(REPORT_DETAILS_MAX);
    expect(parseQuestionReport({ reason: 'unclear', details: '   ' })!.details).toBeNull();
    expect(parseQuestionReport({ reason: 'unclear', details: 42 })!.details).toBeNull();
  });

  it('ignores a language that is not written as one', () => {
    expect(parseQuestionReport({ reason: 'typo', locale: 'not a locale' })!.locale).toBeNull();
    expect(parseQuestionReport({ reason: 'typo', locale: 12 })!.locale).toBeNull();
  });
});
