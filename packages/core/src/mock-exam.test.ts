import { describe, expect, it } from 'vitest';

import { parseBlueprint, type ExamFormat } from './exam-format';
import { buildMockExam, MockExamError } from './mock-exam';
import { createRandom } from './random';
import { question, questions } from './test-fixtures';

const format = (overrides: Partial<ExamFormat> = {}): ExamFormat => ({
  id: 'f1',
  name: 'Citizenship test',
  questionCount: 20,
  passMark: 15,
  timeLimitMinutes: 45,
  blueprint: parseBlueprint(null),
  ...overrides,
});

describe('buildMockExam', () => {
  const pool = questions('q', 40);

  it('draws the right number of distinct questions, with the time limit and pass mark', () => {
    const exam = buildMockExam(format(), pool, { random: createRandom(1) });
    expect(exam.questionIds).toHaveLength(20);
    expect(new Set(exam.questionIds).size).toBe(20);
    expect(exam).toMatchObject({
      formatId: 'f1',
      questionCount: 20,
      passMark: 15,
      timeLimitMs: 45 * 60_000,
      stopEarly: false,
    });
    expect(exam.sections).toEqual([
      {
        id: 'all',
        label: 'Citizenship test',
        questionIds: expect.any(Array),
        mustAllBeCorrect: false,
      },
    ]);
  });

  it('is reproducible from its seed and varies between seeds', () => {
    const one = buildMockExam(format(), pool, { random: createRandom(5) });
    expect(buildMockExam(format(), pool, { random: createRandom(5) })).toEqual(one);
    expect(buildMockExam(format(), pool, { random: createRandom(6) }).questionIds).not.toEqual(
      one.questionIds,
    );
  });

  it('has no time limit for an untimed (oral) exam', () => {
    const exam = buildMockExam(
      format({ timeLimitMinutes: null, blueprint: parseBlueprint({ stopEarly: true }) }),
      pool,
      {
        random: createRandom(1),
      },
    );
    expect(exam).toMatchObject({ timeLimitMs: null, stopEarly: true });
  });

  it('says when the pool is too small', () => {
    expect(() => buildMockExam(format(), questions('q', 19), { random: createRandom(1) })).toThrow(
      new MockExamError('"Citizenship test" needs 20 questions but only 19 are available.'),
    );
  });

  it('fills each section from its own topics, without repeating a question', () => {
    const values = questions('values', 6, { topicId: 't-values', topicSlug: 'values' });
    const general = questions('general', 16);
    const blueprint = parseBlueprint({
      sections: [
        {
          id: 'values',
          label: 'Values',
          count: 5,
          source: { topics: ['values'] },
          mustAllBeCorrect: true,
        },
        { id: 'general', label: 'General', count: 15, source: { excludeTopics: ['values'] } },
      ],
    });
    const exam = buildMockExam(format({ blueprint }), [...values, ...general], {
      random: createRandom(3),
    });
    const [valuesSection, generalSection] = exam.sections;
    expect(valuesSection!.questionIds.every((id) => id.startsWith('values-'))).toBe(true);
    expect(valuesSection!.mustAllBeCorrect).toBe(true);
    expect(generalSection!.questionIds.every((id) => id.startsWith('general-'))).toBe(true);
    expect(new Set(exam.questionIds).size).toBe(20);
  });

  it('draws regional questions only from the learner’s region, and keeps them out of national sections', () => {
    const blueprint = parseBlueprint({
      sections: [
        { id: 'general', label: 'General', count: 3 },
        { id: 'state', label: 'State', count: 2, source: { regional: true } },
      ],
    });
    const regionalPool = [
      ...questions('national', 3),
      ...questions('berlin', 2, { regionCode: 'DE-BE' }),
      ...questions('bavaria', 5, { regionCode: 'DE-BY' }),
    ];
    const exam = buildMockExam(format({ questionCount: 5, blueprint }), regionalPool, {
      random: createRandom(1),
      region: 'DE-BE',
    });
    expect([...exam.sections[0]!.questionIds].sort()).toEqual([
      'national-0',
      'national-1',
      'national-2',
    ]);
    expect([...exam.sections[1]!.questionIds].sort()).toEqual(['berlin-0', 'berlin-1']);
  });

  it('needs the learner’s region for a regional section', () => {
    const blueprint = parseBlueprint({
      sections: [{ id: 'state', label: 'State questions', count: 1, source: { regional: true } }],
    });
    expect(() =>
      buildMockExam(
        format({ questionCount: 1, blueprint }),
        [question('x', { regionCode: 'DE-BE' })],
        {
          random: createRandom(1),
        },
      ),
    ).toThrow('"State questions" needs the learner\'s region.');
  });
});
