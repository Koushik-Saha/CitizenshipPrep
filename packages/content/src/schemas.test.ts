import { describe, expect, it } from 'vitest';

import { checkDraft, checkTranslation, type DraftQuestion } from './schemas';

const passage =
  'The Constitution is the supreme law of the land. It sets up the government and protects the basic rights of Americans.';

const good: DraftQuestion = {
  text: 'What is the supreme law of the land?',
  options: {
    a: 'The Declaration of Independence',
    b: 'The Constitution',
    c: 'The Bill of Rights',
    d: 'The Articles of Confederation',
  },
  correct: 'b',
  explanation: 'The passage says the Constitution is the supreme law of the land.',
  source_quote: 'The Constitution is the supreme law of the land.',
  topic: { slug: 'System of Government', name: 'System of Government' },
  difficulty: 1,
};

describe('checkDraft', () => {
  it('accepts a well-formed draft and normalises it', () => {
    const result = checkDraft(good, passage);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.correctKey).toBe('b');
    expect(result.draft.topic.slug).toBe('system-of-government');
    expect(result.draft.options.map((option) => option.key)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('rejects a quote that is not in the passage', () => {
    const result = checkDraft(
      { ...good, source_quote: 'The Constitution is the highest law in America.' },
      passage,
    );
    expect(result).toEqual({
      ok: false,
      problems: ['source quote does not appear in the passage'],
    });
  });

  it('rejects repeated options, a bad difficulty and a missing quote together', () => {
    const result = checkDraft(
      {
        ...good,
        options: { ...good.options, d: 'the constitution' },
        difficulty: 7,
        source_quote: ' ',
      },
      passage,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toEqual([
      'options must all be different',
      'difficulty must be a whole number from 1 to 5',
      'source quote is missing',
    ]);
  });
});

describe('checkTranslation', () => {
  const sourceOptions = [
    { key: 'a', text: 'The Declaration of Independence' },
    { key: 'b', text: 'The Constitution' },
  ];

  it('keeps the original keys and order', () => {
    const result = checkTranslation(
      {
        text: '¿Cuál es la ley suprema del país?',
        options: [
          { key: 'b', text: 'La Constitución' },
          { key: 'a', text: 'La Declaración de Independencia' },
        ],
        explanation: 'La Constitución es la ley suprema.',
      },
      sourceOptions,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.translation.options.map((option) => option.key)).toEqual(['a', 'b']);
  });

  it('rejects a translation that drops or adds an option', () => {
    const missing = checkTranslation(
      { text: 'x', options: [{ key: 'a', text: 'A' }], explanation: '' },
      sourceOptions,
    );
    expect(missing.ok).toBe(false);
    const extra = checkTranslation(
      {
        text: 'x',
        options: [
          { key: 'a', text: 'A' },
          { key: 'b', text: 'B' },
          { key: 'c', text: 'C' },
        ],
        explanation: '',
      },
      sourceOptions,
    );
    expect(extra.ok).toBe(false);
  });
});
