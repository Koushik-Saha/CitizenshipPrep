import { createRandom, parseBlueprint } from '@oathly/core';
import { describe, expect, it } from 'vitest';

import {
  PackError,
  packClipIds,
  packHistory,
  startOfflineSession,
  type CountryPack,
  type PackQuestion,
} from './pack';
import { countryPackSchema } from './schemas';
import { audioClipUrl, isSpokenFormat, questionWording, type WordingAudio } from './study';

const noAudio: WordingAudio = { question: null, options: null, answer: null, explanation: null };

const question = (n: number, topic: 'government' | 'history'): PackQuestion => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  version: 1,
  topicId: `topic-${topic}`,
  topicName: topic,
  topicSlug: topic,
  difficulty: 1,
  regionCode: null,
  type: 'multiple_choice',
  locale: 'en',
  text: `Question ${n}?`,
  options: [
    { key: 'a', text: 'A' },
    { key: 'b', text: 'B' },
  ],
  correctKeys: ['a'],
  explanation: null,
  audio: noAudio,
  sourceQuote: null,
  sourceUrl: 'https://example.org/guide',
  original: null,
});

const pack: CountryPack = {
  countryCode: 'ZZ',
  countryName: 'Testland',
  countryLocation: { latitude: -35, longitude: -120 },
  generatedAt: '2026-10-01T00:00:00.000Z',
  examFormats: [
    {
      id: 'format-written',
      name: 'Written test',
      questionCount: 6,
      passMark: 4,
      timeLimitMinutes: 10,
      isCurrent: true,
      spoken: false,
      blueprint: parseBlueprint({
        sections: [
          { id: 'gov', label: 'Government', count: 4, source: { topics: ['government'] } },
          { id: 'his', label: 'History', count: 2, source: { topics: ['history'] } },
        ],
      }),
    },
    {
      id: 'format-big',
      name: 'Big test',
      questionCount: 50,
      passMark: 40,
      timeLimitMinutes: null,
      isCurrent: true,
      spoken: false,
      blueprint: parseBlueprint(null),
    },
  ],
  questions: [
    ...[1, 2, 3, 4, 5, 6].map((n) => question(n, 'government')),
    ...[7, 8, 9, 10].map((n) => question(n, 'history')),
  ],
  history: [
    {
      questionId: question(1, 'government').id,
      correct: false,
      timeMs: 4000,
      answeredAt: '2026-09-30T10:00:00.000Z',
    },
  ],
};

const options = (seed = 1) => ({
  attemptId: '11111111-1111-4111-8111-111111111111',
  now: new Date('2026-10-03T12:00:00Z'),
  random: createRandom(seed),
});

describe('startOfflineSession', () => {
  it('matches the shape the server sends', () => {
    expect(countryPackSchema.parse(JSON.parse(JSON.stringify(pack)))).toEqual(pack);
  });

  it('builds a practice session from the pack, and the record to sync later', () => {
    const { session, attempt } = startOfflineSession(
      pack,
      { kind: 'practice', countryCode: 'ZZ', focus: 'random', size: 4 },
      options(),
    );
    expect(session).toMatchObject({
      attemptId: options().attemptId,
      countryCode: 'ZZ',
      countryName: 'Testland',
      mode: 'practice',
      startedAt: '2026-10-03T12:00:00.000Z',
      completedAt: null,
      exam: null,
    });
    expect(session.questions).toHaveLength(4);
    // Engine-only fields stay out of the session.
    expect(session.questions[0]).not.toHaveProperty('topicSlug');
    expect(attempt).toEqual({
      attemptId: options().attemptId,
      countryCode: 'ZZ',
      mode: 'practice',
      questionIds: session.questions.map((q) => q.id),
      examFormatId: null,
      examQuestionIds: null,
      startedAt: '2026-10-03T12:00:00.000Z',
      result: null,
    });
  });

  it('keeps to one topic, caps the size, and makes flashcard decks', () => {
    const { session } = startOfflineSession(
      pack,
      { kind: 'flashcards', countryCode: 'ZZ', focus: { topicId: 'topic-history' }, size: 500 },
      options(),
    );
    expect(session.mode).toBe('flashcards');
    expect(session.questions).toHaveLength(4);
    expect(session.questions.every((q) => q.topicId === 'topic-history')).toBe(true);
  });

  it('adapts to answers made since the pack was downloaded', () => {
    const missed = question(9, 'history').id;
    const { session } = startOfflineSession(
      pack,
      { kind: 'practice', countryCode: 'ZZ', focus: 'adaptive', size: 3 },
      {
        ...options(),
        localAnswers: [
          { questionId: missed, correct: false, timeMs: 3000, answeredAt: '2026-10-02T12:00:00Z' },
        ],
      },
    );
    // Both the stored miss and the local one are due for review.
    const ids = session.questions.map((q) => q.id);
    expect(ids).toContain(missed);
    expect(ids).toContain(question(1, 'government').id);
    expect(packHistory(pack)).toHaveLength(1);
  });

  it('builds a mock exam in the exam’s format, section by section', () => {
    const { session, attempt } = startOfflineSession(
      pack,
      { kind: 'mock_exam', countryCode: 'ZZ', examFormatId: 'format-written' },
      options(7),
    );
    expect(session.mode).toBe('mock_exam');
    expect(session.questions).toHaveLength(6);
    expect(session.exam).toMatchObject({
      name: 'Written test',
      questionCount: 6,
      passMark: 4,
      timeLimitMs: 600_000,
      stopEarly: false,
    });
    expect(session.exam!.sections.map((s) => s.questionIds.length)).toEqual([4, 2]);
    expect(attempt.examFormatId).toBe('format-written');
    expect([...attempt.examQuestionIds!].sort()).toEqual([...attempt.questionIds].sort());
  });

  it('refuses what the pack cannot provide', () => {
    const start = (request: Parameters<typeof startOfflineSession>[1], from = pack) =>
      startOfflineSession(from, request, options());
    expect(() => start({ kind: 'practice', countryCode: 'US', focus: 'random', size: 5 })).toThrow(
      PackError,
    );
    expect(() =>
      start(
        { kind: 'practice', countryCode: 'ZZ', focus: 'random', size: 5 },
        {
          ...pack,
          questions: [],
        },
      ),
    ).toThrow('No questions are published');
    expect(() => start({ kind: 'mock_exam', countryCode: 'ZZ', examFormatId: 'nope' })).toThrow(
      'not in this pack',
    );
    expect(() =>
      start({ kind: 'mock_exam', countryCode: 'ZZ', examFormatId: 'format-big' }),
    ).toThrow(PackError);
    expect(() =>
      start({ kind: 'practice', countryCode: 'ZZ', focus: { topicId: 'none' }, size: 5 }),
    ).toThrow('No questions match');
  });
});

describe('questionWording', () => {
  const english = question(1, 'government');
  const translated: PackQuestion = {
    ...english,
    locale: 'es',
    text: '¿Pregunta 1?',
    explanation: 'Porque sí.',
    original: {
      locale: 'en',
      text: english.text,
      options: english.options,
      explanation: null,
      audio: { ...noAudio, question: 'c'.repeat(64) },
    },
  };

  it('shows the study language unless the exam’s is asked for', () => {
    expect(questionWording(translated, false)).toEqual({
      locale: 'es',
      text: '¿Pregunta 1?',
      options: english.options,
      explanation: 'Porque sí.',
      audio: noAudio,
    });
    // Each wording has its own recordings.
    expect(questionWording(translated, true).audio.question).toBe('c'.repeat(64));
    expect(questionWording(translated, true)).toBe(translated.original);
  });

  it('has only one wording for a question the exam’s language already covers', () => {
    expect(questionWording(english, true)).toMatchObject({ locale: 'en', text: 'Question 1?' });
  });

  it('keeps both wordings when a session is built from a pack', () => {
    const { session } = startOfflineSession(
      { ...pack, questions: [translated, ...pack.questions.slice(1)] },
      { kind: 'practice', countryCode: 'ZZ', focus: 'random', size: 50 },
      { attemptId: 'a', now: new Date('2026-10-02T00:00:00Z'), random: createRandom(1) },
    );
    expect(session.questions.find((q) => q.id === translated.id)?.original?.locale).toBe('en');
  });
});

describe('spoken exams and clips', () => {
  it('knows which kinds of exam are asked aloud', () => {
    expect(isSpokenFormat('oral')).toBe(true);
    expect(isSpokenFormat('interview')).toBe(true);
    expect(isSpokenFormat('written')).toBe(false);
    expect(isSpokenFormat('language')).toBe(false);
  });

  it('carries the exam’s kind into a session built from a pack', () => {
    const spoken = { ...pack, examFormats: [{ ...pack.examFormats[0]!, spoken: true }] };
    const { session } = startOfflineSession(
      spoken,
      { kind: 'mock_exam', countryCode: 'ZZ', examFormatId: 'format-written' },
      { attemptId: 'a', now: new Date('2026-10-02T00:00:00Z'), random: createRandom(1) },
    );
    expect(session.exam?.spoken).toBe(true);
  });

  it('lists the clips a pack needs saved, each once', () => {
    const a = 'a'.repeat(64);
    const b = 'b'.repeat(64);
    const c = 'c'.repeat(64);
    const first = { ...question(1, 'government'), audio: { ...noAudio, question: a, options: b } };
    const second: PackQuestion = {
      ...question(2, 'government'),
      audio: { ...noAudio, options: b },
      original: {
        locale: 'en',
        text: 'Q',
        options: [],
        explanation: null,
        audio: { ...noAudio, question: c, answer: a },
      },
    };
    expect(packClipIds({ questions: [first, second] }).sort()).toEqual([a, b, c]);
    expect(packClipIds(pack)).toEqual([]);
  });

  it('builds a clip’s address from the web app’s', () => {
    expect(audioClipUrl('https://oathly.example/', 'abc')).toBe(
      'https://oathly.example/api/audio/abc',
    );
    expect(audioClipUrl('http://localhost:3000', 'abc')).toBe(
      'http://localhost:3000/api/audio/abc',
    );
  });
});
