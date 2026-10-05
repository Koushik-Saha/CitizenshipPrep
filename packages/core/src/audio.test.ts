import { describe, expect, it } from 'vitest';

import {
  canAnswerAloud,
  clipKey,
  clipTexts,
  feedbackCues,
  promptCues,
  type SpokenQuestion,
} from './audio';

const question: SpokenQuestion = {
  type: 'multiple_choice',
  text: '  What is the supreme law\n of the land? ',
  options: [
    { key: 'a', text: 'the Constitution' },
    { key: 'b', text: 'the Declaration of Independence' },
    { key: 'c', text: 'the Bill of Rights' },
  ],
  correctKeys: ['a'],
  explanation: 'The Constitution sets up the government.',
};

describe('clipTexts', () => {
  it('gives the words for each part, with the choices numbered', () => {
    expect(clipTexts(question)).toEqual({
      question: 'What is the supreme law of the land?',
      options: '1. the Constitution\n2. the Declaration of Independence\n3. the Bill of Rights',
      answer: 'the Constitution',
      explanation: 'The Constitution sets up the government.',
    });
  });

  it('says every right answer of a multi-select question', () => {
    expect(clipTexts({ ...question, type: 'multi_select', correctKeys: ['a', 'c'] }).answer).toBe(
      'the Constitution. the Bill of Rights',
    );
  });

  it('does not read out the accepted answers of a free-response question, and says only one', () => {
    const open = clipTexts({ ...question, type: 'free_response', correctKeys: ['a', 'c'] });
    expect(open.options).toBeNull();
    expect(open.answer).toBe('the Constitution');
  });

  it('leaves out what there is nothing to say for', () => {
    const bare = clipTexts({
      ...question,
      text: ' ',
      options: [
        { key: 'a', text: '' },
        { key: 'b', text: 'Yes' },
      ],
      explanation: null,
    });
    expect(bare).toEqual({ question: null, options: null, answer: null, explanation: null });
    expect(clipTexts({ ...question, options: [] }).options).toBeNull();
  });
});

describe('clipKey', () => {
  it('tells the same words in two languages apart', () => {
    expect(clipKey('en', 'No')).toBe('en\nNo');
    expect(clipKey('es', 'No')).not.toBe(clipKey('en', 'No'));
  });
});

describe('cues', () => {
  it('reads the question and its choices, but only the question in a spoken exam', () => {
    expect(promptCues({ spokenExam: false })).toEqual([
      { kind: 'clip', part: 'question' },
      { kind: 'clip', part: 'options' },
    ]);
    expect(promptCues({ spokenExam: true })).toEqual([{ kind: 'clip', part: 'question' }]);
  });

  it('gives the verdict, then the right answer if it was missed, then the explanation', () => {
    expect(feedbackCues(true)).toEqual([
      { kind: 'phrase', phrase: 'correct' },
      { kind: 'clip', part: 'explanation' },
    ]);
    expect(feedbackCues(false)).toEqual([
      { kind: 'phrase', phrase: 'notQuite' },
      { kind: 'clip', part: 'answer' },
      { kind: 'clip', part: 'explanation' },
    ]);
  });

  it('takes spoken answers for anything with a single answer', () => {
    expect(canAnswerAloud('multiple_choice')).toBe(true);
    expect(canAnswerAloud('free_response')).toBe(true);
    expect(canAnswerAloud('multi_select')).toBe(false);
  });
});
