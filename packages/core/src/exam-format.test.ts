import { describe, expect, it } from 'vitest';

import { examSections, ExamFormatError, parseBlueprint, type ExamFormat } from './exam-format';

const format = (overrides: Partial<ExamFormat> = {}): ExamFormat => ({
  id: 'f1',
  name: 'Citizenship test',
  questionCount: 20,
  passMark: 15,
  timeLimitMinutes: 45,
  blueprint: parseBlueprint(null),
  ...overrides,
});

describe('parseBlueprint', () => {
  it('treats a missing blueprint as no special rules', () => {
    expect(parseBlueprint(null)).toEqual({ stopEarly: false });
    expect(parseBlueprint(undefined)).toEqual({ stopEarly: false });
  });

  it('fills in defaults for sections', () => {
    expect(parseBlueprint({ sections: [{ id: 'all', label: 'All', count: 20 }] })).toEqual({
      stopEarly: false,
      sections: [{ id: 'all', label: 'All', count: 20, source: {}, mustAllBeCorrect: false }],
    });
  });

  it('rejects anything malformed, naming the problem', () => {
    expect(() => parseBlueprint({ sections: [] })).toThrow(ExamFormatError);
    expect(() => parseBlueprint({ sections: [{ id: 'x', label: 'X', count: 0 }] })).toThrow(
      /Invalid exam blueprint/,
    );
    expect(() => parseBlueprint({ surprise: true })).toThrow(ExamFormatError);
  });
});

describe('examSections', () => {
  it('uses one section for the whole exam when there is no blueprint', () => {
    expect(examSections(format())).toEqual([
      { id: 'all', label: 'Citizenship test', count: 20, source: {}, mustAllBeCorrect: false },
    ]);
  });

  it('uses the blueprint’s sections when they add up', () => {
    const blueprint = parseBlueprint({
      sections: [
        { id: 'values', label: 'Values', count: 5, mustAllBeCorrect: true },
        { id: 'general', label: 'General', count: 15 },
      ],
    });
    expect(examSections(format({ blueprint })).map((section) => section.id)).toEqual([
      'values',
      'general',
    ]);
  });

  it('refuses sections that do not add up to the question count', () => {
    const blueprint = parseBlueprint({ sections: [{ id: 'a', label: 'A', count: 19 }] });
    expect(() => examSections(format({ blueprint }))).toThrow('add up to 19 questions, not 20');
  });

  it('refuses a format with no fixed number of questions', () => {
    expect(() => examSections(format({ name: 'Interview', questionCount: null }))).toThrow(
      '"Interview" has no fixed number of questions to practise.',
    );
  });
});
