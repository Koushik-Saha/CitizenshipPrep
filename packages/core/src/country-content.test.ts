import { describe, expect, it } from 'vitest';

import {
  isCountryComplete,
  MIN_TOPIC_QUESTIONS,
  MOCK_EXAMS_OF_QUESTIONS,
  questionsNeeded,
} from './country-content';

describe('questionsNeeded', () => {
  it('is the whole official pool where the pool is published', () => {
    expect(questionsNeeded([{ questionCount: 33, questionPoolSize: 310 }])).toBe(310);
  });

  it('is enough for several different mock exams where it is not', () => {
    expect(questionsNeeded([{ questionCount: 24, questionPoolSize: null }])).toBe(
      24 * MOCK_EXAMS_OF_QUESTIONS,
    );
  });

  it('is what the most demanding current exam asks for', () => {
    expect(
      questionsNeeded([
        { questionCount: 20, questionPoolSize: 128 },
        { questionCount: null, questionPoolSize: null },
      ]),
    ).toBe(128);
    expect(questionsNeeded([])).toBe(0);
  });
});

describe('isCountryComplete', () => {
  const exams = [{ questionCount: 20, questionPoolSize: null }];

  it('is complete with every topic covered and enough questions', () => {
    expect(
      isCountryComplete({ publishedQuestions: 115, topicQuestions: [27, 21, 37, 30], exams }),
    ).toBe(true);
  });

  it('is not while a topic has no questions, or too few', () => {
    expect(
      isCountryComplete({ publishedQuestions: 150, topicQuestions: [140, 10, 0], exams }),
    ).toBe(false);
    expect(
      isCountryComplete({
        publishedQuestions: 150,
        topicQuestions: [141, MIN_TOPIC_QUESTIONS - 1],
        exams,
      }),
    ).toBe(false);
  });

  it('is not with too few questions overall, however they are spread', () => {
    expect(
      isCountryComplete({
        publishedQuestions: 48,
        topicQuestions: [24, 24],
        exams: [{ questionCount: 24, questionPoolSize: null }],
      }),
    ).toBe(false);
    // A published pool must be covered in full.
    expect(
      isCountryComplete({
        publishedQuestions: 300,
        topicQuestions: [100, 100, 100],
        exams: [{ questionCount: 33, questionPoolSize: 310 }],
      }),
    ).toBe(false);
  });

  it('is not without a topic or an exam to measure against', () => {
    expect(isCountryComplete({ publishedQuestions: 500, topicQuestions: [], exams })).toBe(false);
    expect(isCountryComplete({ publishedQuestions: 500, topicQuestions: [500], exams: [] })).toBe(
      false,
    );
  });
});
