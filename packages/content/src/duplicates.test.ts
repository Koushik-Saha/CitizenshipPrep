import { describe, expect, it } from 'vitest';

import { findDuplicate, similarity } from './duplicates';

const existing = [
  { id: 'q1', text: 'What is the supreme law of the land?' },
  { id: 'q2', text: 'How many amendments does the U.S. Constitution have?' },
  { id: 'q3', text: 'Wie viele Bundesländer hat die Bundesrepublik Deutschland?' },
];

describe('similarity', () => {
  it('is 1 for the same wording and near 0 for unrelated questions', () => {
    expect(similarity('What is the capital?', 'what is the capital')).toBe(1);
    expect(
      similarity('What is the supreme law of the land?', 'Who was the first President?'),
    ).toBeLessThan(0.4);
  });

  it('is symmetric', () => {
    const a = 'What is the supreme law of the land?';
    const b = 'What is the highest law of the land?';
    expect(similarity(a, b)).toBeCloseTo(similarity(b, a), 10);
  });
});

describe('findDuplicate', () => {
  it('reports the same wording as an exact duplicate, ignoring case and punctuation', () => {
    expect(findDuplicate('what is the SUPREME law of the land', existing)).toEqual({
      id: 'q1',
      score: 1,
      exact: true,
    });
  });

  it('reports a light rewording as a near duplicate', () => {
    const match = findDuplicate('What is the supreme law of our land?', existing);
    expect(match?.id).toBe('q1');
    expect(match?.exact).toBe(false);
    expect(match!.score).toBeGreaterThan(0.82);
  });

  it('works for languages other than English', () => {
    const match = findDuplicate('Wie viele Bundesländer hat Deutschland?', existing, 0.7);
    expect(match?.id).toBe('q3');
  });

  it('lets a different question through', () => {
    expect(findDuplicate('How many U.S. senators are there?', existing)).toBeNull();
    expect(findDuplicate('Anything', [])).toBeNull();
  });
});
