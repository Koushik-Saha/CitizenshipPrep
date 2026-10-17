import { describe, expect, it } from 'vitest';

import {
  normalizeOption,
  questionProblems,
  type CheckedQuestion,
  type CheckedWording,
} from './question-check';

const wording = (overrides: Partial<CheckedWording> = {}): CheckedWording => ({
  locale: 'en',
  options: [
    { key: 'a', text: 'Freedom of speech' },
    { key: 'b', text: 'The right to bear arms' },
    { key: 'c', text: 'Trial by jury' },
    { key: 'd', text: 'Freedom of religion' },
  ],
  explanation: 'The First Amendment protects it. It was ratified in 1791.',
  ...overrides,
});

const choice = (overrides: Partial<CheckedQuestion> = {}): CheckedQuestion => ({
  type: 'multiple_choice',
  correctKeys: ['a'],
  sourceUrl: 'https://www.uscis.gov/citizenship',
  wordings: [wording()],
  ...overrides,
});

const codes = (question: CheckedQuestion) => questionProblems(question).map((p) => p.code);

describe('questionProblems', () => {
  it('passes a well-formed question of each type', () => {
    expect(questionProblems(choice())).toEqual([]);
    expect(
      questionProblems(
        choice({
          type: 'true_false',
          wordings: [
            wording({
              options: [
                { key: 'a', text: 'True' },
                { key: 'b', text: 'False' },
              ],
            }),
          ],
        }),
      ),
    ).toEqual([]);
    // An open question's options are its accepted answers; one is enough.
    expect(
      questionProblems(
        choice({
          type: 'free_response',
          wordings: [wording({ options: [{ key: 'a', text: 'The Civil War' }] })],
        }),
      ),
    ).toEqual([]);
  });

  it('flags a choice question without exactly four options, in the language it is short in', () => {
    const lonely = choice({
      wordings: [wording(), wording({ locale: 'es', options: [{ key: 'a', text: 'Libertad' }] })],
    });
    expect(questionProblems(lonely)).toContainEqual({
      code: 'option-count',
      locale: 'es',
      detail: '1 option(s); a multiple_choice has 4.',
    });
    expect(codes(lonely)).toContain('keys-differ');
    // An open question needs at least one accepted answer.
    expect(
      questionProblems(choice({ type: 'free_response', wordings: [wording({ options: [] })] })),
    ).toContainEqual({
      code: 'option-count',
      locale: 'en',
      detail: '0 option(s); a free_response has at least 1.',
    });
  });

  it('flags blank options and options that differ only in case, spacing, punctuation or an article', () => {
    expect(
      codes(
        choice({
          wordings: [
            wording({
              options: [
                { key: 'a', text: 'Freedom of speech' },
                { key: 'b', text: '   ' },
                { key: 'c', text: 'the  freedom of Speech.' },
                { key: 'd', text: 'Trial by jury' },
              ],
            }),
          ],
        }),
      ),
    ).toEqual(['empty-option', 'duplicate-option']);
    expect(normalizeOption('  The U.S. Constitution! ')).toBe('u s constitution');
    expect(normalizeOption('Theodore Roosevelt')).toBe('theodore roosevelt');
  });

  it('flags a right answer that is not among the options, and the wrong number of right answers', () => {
    expect(codes(choice({ correctKeys: ['e'] }))).toEqual(['correct-not-in-options']);
    expect(codes(choice({ correctKeys: [] }))).toEqual(['no-correct-answer']);
    expect(codes(choice({ correctKeys: ['a', 'b'] }))).toEqual(['wrong-number-correct']);
    expect(codes(choice({ type: 'multi_select', correctKeys: ['a', 'b', 'c', 'd'] }))).toEqual([
      'wrong-number-correct',
    ]);
    expect(
      codes(
        choice({
          type: 'free_response',
          correctKeys: ['a'],
          wordings: [
            wording({
              options: [
                { key: 'a', text: 'Freedom' },
                { key: 'b', text: 'Liberty' },
              ],
            }),
          ],
        }),
      ),
    ).toEqual(['accepted-answer-not-correct']);
  });

  it('flags a missing explanation or source, and a question with no wording', () => {
    expect(questionProblems(choice({ wordings: [wording({ explanation: ' ' })] }))).toEqual([
      { code: 'no-explanation', locale: 'en', detail: 'It has no explanation.' },
    ]);
    expect(codes(choice({ sourceUrl: null }))).toEqual(['no-source']);
    expect(codes(choice({ sourceUrl: 'http://example.org' }))).toEqual(['no-source']);
    expect(codes(choice({ wordings: [] }))).toEqual(['no-wording']);
  });

  it('flags two options sharing a key', () => {
    expect(
      codes(
        choice({
          wordings: [
            wording({
              options: [
                { key: 'a', text: 'One' },
                { key: 'a', text: 'Two' },
                { key: 'c', text: 'Three' },
                { key: 'd', text: 'Four' },
              ],
            }),
          ],
        }),
      ),
    ).toEqual(['duplicate-key']);
  });
});
