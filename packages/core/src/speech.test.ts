import { describe, expect, it } from 'vitest';

import { matchSpokenAnswer, spokenTokens, type SpokenOption } from './speech';

const law: SpokenOption[] = [
  { key: 'a', text: 'the Constitution' },
  { key: 'b', text: 'the Declaration of Independence' },
  { key: 'c', text: 'the Bill of Rights' },
];
const interview = { byPosition: false };
const listed = { byPosition: true };

describe('spokenTokens', () => {
  it('folds case, accents and punctuation', () => {
    expect(spokenTokens("It's Washington, D.C.!", 'en')).toEqual(['its', 'washington', 'dc']);
    expect(spokenTokens('¿Cuántos años?', 'es')).toEqual(['cuantos', 'anos']);
    expect(spokenTokens('  ', 'en')).toEqual([]);
  });

  it('reads number words and other scripts’ digits as digits', () => {
    expect(spokenTokens('Twenty-seven or two', 'en')).toEqual([
      'twenty',
      'seven'.replace('seven', '7'),
      'or',
      '2',
    ]);
    expect(spokenTokens('dos', 'es-MX')).toEqual(['2']);
    expect(spokenTokens('٢٧', 'ar')).toEqual(['27']);
    expect(spokenTokens('२७', 'hi')).toEqual(['27']);
    expect(spokenTokens('পাঁচ', 'bn')).toEqual(['5']);
    expect(spokenTokens('bốn', 'vi')).toEqual(['4']);
    expect(spokenTokens('أَربعة', 'ar')).toEqual(['4']);
    // A language with no number words listed, and a script whose digits are not mapped.
    expect(spokenTokens('zwei ๓', 'nl')).toEqual(['zwei', '๓']);
  });

  it('takes unspaced scripts a character at a time', () => {
    expect(spokenTokens('宪法 三', 'zh-Hans')).toEqual(['宪', '法', '3']);
  });
});

describe('matchSpokenAnswer', () => {
  it('finds the option in a sentence, whatever else was said', () => {
    expect(matchSpokenAnswer(["it's the constitution"], law, 'en', interview)).toEqual({
      kind: 'option',
      key: 'a',
    });
    expect(matchSpokenAnswer(['constitution'], law, 'en', interview)).toEqual({
      kind: 'option',
      key: 'a',
    });
    expect(matchSpokenAnswer(['um, the bill of rights I think'], law, 'en', interview)).toEqual({
      kind: 'option',
      key: 'c',
    });
  });

  it('forgives a small slip in a long word, but not in a short one or a number', () => {
    const people: SpokenOption[] = [
      { key: 'a', text: 'Thomas Jefferson' },
      { key: 'b', text: 'Abraham Lincoln' },
    ];
    expect(matchSpokenAnswer(['tomas jeferson'], people, 'en', interview)).toEqual({
      kind: 'option',
      key: 'a',
    });
    expect(matchSpokenAnswer(['Abrahem Lincon'], people, 'en', interview)).toEqual({
      kind: 'option',
      key: 'b',
    });
    // Two slips are forgiven only in a very long word.
    expect(
      matchSpokenAnswer(
        ['independance day'],
        [{ key: 'a', text: 'Independence Day' }],
        'en',
        interview,
      ),
    ).toEqual({ kind: 'option', key: 'a' });
    expect(
      matchSpokenAnswer(
        ['indepandance day'],
        [{ key: 'a', text: 'Independence Day' }],
        'en',
        interview,
      ),
    ).toEqual({ kind: 'option', key: 'a' });
    expect(
      matchSpokenAnswer(
        ['indepandanse night'],
        [{ key: 'a', text: 'Independence Day' }],
        'en',
        interview,
      ),
    ).toEqual({ kind: 'unmatched' });
    const years: SpokenOption[] = [
      { key: 'a', text: '1776' },
      { key: 'b', text: '1787' },
    ];
    expect(matchSpokenAnswer(['1777'], years, 'en', interview)).toEqual({ kind: 'unmatched' });
    expect(matchSpokenAnswer(['in 1787'], years, 'en', interview)).toEqual({
      kind: 'option',
      key: 'b',
    });
    expect(matchSpokenAnswer(['cat'], [{ key: 'a', text: 'car' }], 'en', interview)).toEqual({
      kind: 'unmatched',
    });
    // Words of very different lengths are not compared letter by letter.
    expect(
      matchSpokenAnswer(['constitutional'], [{ key: 'a', text: 'constant' }], 'en', interview),
    ).toEqual({ kind: 'unmatched' });
  });

  it('takes a number as the choice’s place only when the choices were read out', () => {
    expect(matchSpokenAnswer(['two'], law, 'en', listed)).toEqual({ kind: 'option', key: 'b' });
    expect(matchSpokenAnswer(['number 3'], law, 'en', listed)).toEqual({
      kind: 'option',
      key: 'c',
    });
    expect(matchSpokenAnswer(['dos'], law, 'es', listed)).toEqual({ kind: 'option', key: 'b' });
    expect(matchSpokenAnswer(['two'], law, 'en', interview)).toEqual({ kind: 'unmatched' });
    // Not a place in this list, and not a lone number.
    expect(matchSpokenAnswer(['seven'], law, 'en', listed)).toEqual({ kind: 'unmatched' });
    expect(matchSpokenAnswer(['zero'.replace('zero', '0')], law, 'en', listed)).toEqual({
      kind: 'unmatched',
    });
    expect(matchSpokenAnswer(['1 or 2'], law, 'en', listed)).toEqual({ kind: 'unmatched' });
    expect(matchSpokenAnswer(['I would say it is number two'], law, 'en', listed)).toEqual({
      kind: 'unmatched',
    });
  });

  it('prefers the answer itself to its place when the options are numbers', () => {
    const sums: SpokenOption[] = [
      { key: 'a', text: '3' },
      { key: 'b', text: '2' },
      { key: 'c', text: '1' },
    ];
    expect(matchSpokenAnswer(['two'], sums, 'en', listed)).toEqual({ kind: 'option', key: 'b' });
  });

  it('settles options that contain one another by what was said exactly', () => {
    const capitals: SpokenOption[] = [
      { key: 'a', text: 'Washington' },
      { key: 'b', text: 'Washington, D.C.' },
    ];
    expect(matchSpokenAnswer(['Washington DC'], capitals, 'en', interview)).toEqual({
      kind: 'option',
      key: 'b',
    });
    expect(matchSpokenAnswer(['washington'], capitals, 'en', interview)).toEqual({
      kind: 'option',
      key: 'a',
    });
    // Neither exactly, and too close to call.
    expect(matchSpokenAnswer(['in washington dc'], capitals, 'en', interview)).toEqual({
      kind: 'unmatched',
    });
    // The same words on two options cannot be told apart.
    expect(
      matchSpokenAnswer(
        ['yes'],
        [
          { key: 'a', text: 'Yes' },
          { key: 'b', text: 'yes.' },
        ],
        'en',
        interview,
      ),
    ).toEqual({ kind: 'unmatched' });
  });

  it('uses the first reading that matches', () => {
    expect(
      matchSpokenAnswer(['the constant tuition', 'the constitution'], law, 'en', interview),
    ).toEqual({
      kind: 'option',
      key: 'a',
    });
  });

  it('works in other languages and scripts', () => {
    expect(
      matchSpokenAnswer(
        ['la constitucion'],
        [
          { key: 'a', text: 'la Constitución' },
          { key: 'b', text: 'la Declaración de Independencia' },
        ],
        'es',
        interview,
      ),
    ).toEqual({ kind: 'option', key: 'a' });
    expect(
      matchSpokenAnswer(
        ['是宪法'],
        [
          { key: 'a', text: '宪法' },
          { key: 'b', text: '独立宣言' },
        ],
        'zh-Hans',
        interview,
      ),
    ).toEqual({ kind: 'option', key: 'a' });
  });

  it('says when nothing matched, and when nothing was heard', () => {
    expect(matchSpokenAnswer(['the president'], law, 'en', interview)).toEqual({
      kind: 'unmatched',
    });
    expect(matchSpokenAnswer(['anything'], [], 'en', interview)).toEqual({ kind: 'unmatched' });
    expect(matchSpokenAnswer(['anything'], [{ key: 'a', text: '' }], 'en', interview)).toEqual({
      kind: 'unmatched',
    });
    expect(matchSpokenAnswer([], law, 'en', interview)).toEqual({ kind: 'silence' });
    expect(matchSpokenAnswer(['', ' ... '], law, 'en', interview)).toEqual({ kind: 'silence' });
  });
});
