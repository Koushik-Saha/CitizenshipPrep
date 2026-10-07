import { translatorFor } from '@oathly/i18n/messages';
import { describe, expect, it } from 'vitest';

import type { ExamDetails, TestPages } from './countries';
import { examFactRows, publicSitePages, testFaq, topicFaq } from './seo';

const t = translatorFor('en');
const es = translatorFor('es');

/** Removes the invisible marks that keep embedded names reading the right way. */
const plain = (text: string) => text.replace(/[\u2066-\u2069]/g, '');

const written: ExamDetails = {
  name: 'Knowledge test',
  formatType: 'written',
  questionCount: 20,
  passMark: 15,
  timeLimitMinutes: 45,
  questionPoolSize: null,
  notes: null,
  sourceUrl: 'https://example.org/test',
  lastVerifiedAt: '2026-09-01T00:00:00.000Z',
};
const oral: ExamDetails = {
  ...written,
  name: 'Civics interview',
  formatType: 'oral',
  passMark: 12,
  timeLimitMinutes: null,
  questionPoolSize: 128,
  sourceUrl: 'https://example.org/oral',
};
const language: ExamDetails = {
  ...written,
  name: 'Language test',
  formatType: 'language',
  questionCount: null,
  passMark: null,
  timeLimitMinutes: null,
};

describe('examFactRows', () => {
  it('lays out what the format fixes, with the pass mark as a share of the questions', () => {
    expect(examFactRows(written, t)).toEqual([
      { id: 'type', label: 'Type', value: 'Written test' },
      { id: 'questions', label: 'Questions', value: '20 questions' },
      { id: 'passMark', label: 'Pass mark', value: '15 of 20 (75%)' },
      { id: 'time', label: 'Time limit', value: '45 minutes' },
    ]);
  });

  it('adds the pool the questions are drawn from', () => {
    expect(examFactRows(oral, t)).toEqual([
      { id: 'type', label: 'Type', value: 'Oral test' },
      { id: 'questions', label: 'Questions', value: '20 questions' },
      { id: 'passMark', label: 'Pass mark', value: '12 of 20 (60%)' },
      { id: 'pool', label: 'Question pool', value: '128 questions' },
    ]);
  });

  it('says only the type of a format with no numbers', () => {
    expect(examFactRows(language, t)).toEqual([
      { id: 'type', label: 'Type', value: 'Language test' },
    ]);
    expect(examFactRows({ ...language, formatType: 'interview' }, t)[0]!.value).toBe('Interview');
  });

  it('gives a pass mark on its own when the number of questions is not fixed', () => {
    expect(examFactRows({ ...written, questionCount: null }, t)).toContainEqual({
      id: 'passMark',
      label: 'Pass mark',
      value: '15 to pass',
    });
  });

  it('is in the reader’s language', () => {
    expect(examFactRows(written, es)[1]).toEqual({
      id: 'questions',
      label: 'Preguntas',
      value: '20 preguntas',
    });
  });
});

const guide = {
  exams: [written],
  examLanguages: ['en', 'fr'],
  topics: [
    { slug: 'history', name: 'History', publishedQuestions: 12 },
    { slug: 'rights', name: 'Rights', publishedQuestions: 3 },
    { slug: 'culture', name: 'Culture', publishedQuestions: 0 },
  ],
  publishedQuestions: 15,
};

const faqOf = (items: { question: string; answer: string }[]) =>
  items.map((item) => [plain(item.question), plain(item.answer)]);

describe('testFaq', () => {
  it('answers what the exam’s numbers answer', () => {
    expect(faqOf(testFaq(guide, 'Canada', t))).toEqual([
      [
        'How many questions are on the Canada citizenship test?',
        'The Knowledge test has 20 questions.',
      ],
      [
        'What score do you need to pass the Canada citizenship test?',
        'To pass the Knowledge test you need 15 correct answers out of 20 (75%).',
      ],
      [
        'How long does the Canada citizenship test take?',
        'You have 45 minutes for the Knowledge test.',
      ],
      [
        'What language is the Canada citizenship test in?',
        'The test is taken in English or French.',
      ],
      [
        'What does the Canada citizenship test cover?',
        // Only topics with questions to practise.
        'Oathly’s practice questions cover 2 topics: History and Rights.',
      ],
      [
        'Where do these practice questions come from?',
        expect.stringContaining('written from the official study material'),
      ],
      [
        'Is Oathly an official government website?',
        expect.stringContaining('not affiliated with any government'),
      ],
    ]);
  });

  it('points to the exam’s official page from the last answer', () => {
    expect(testFaq(guide, 'Canada', t).at(-1)!.link).toBe('https://example.org/test');
    expect(testFaq({ ...guide, exams: [] }, 'Canada', t).at(-1)).not.toHaveProperty('link');
  });

  it('gives each exam its own sentence, and mentions the pool where there is one', () => {
    const faq = faqOf(testFaq({ ...guide, exams: [written, oral, language] }, 'Testland', t));
    expect(faq[0]![1]).toBe(
      'The Knowledge test has 20 questions. ' +
        'The Civics interview has 20 questions, drawn from a pool of 128.',
    );
    expect(faq[1]![1]).toBe(
      'To pass the Knowledge test you need 15 correct answers out of 20 (75%). ' +
        'To pass the Civics interview you need 12 correct answers out of 20 (60%).',
    );
    // Only the written test is timed.
    expect(faq[2]![1]).toBe('You have 45 minutes for the Knowledge test.');
  });

  it('does not ask about a fact the format does not fix', () => {
    const questions = testFaq(
      { exams: [language], examLanguages: [], topics: [], publishedQuestions: 0 },
      'Testland',
      t,
    ).map((item) => item.question);
    // Nothing to practise yet, so no claim about where the questions come from.
    expect(questions).toEqual(['Is Oathly an official government website?']);
  });

  it('states a pass mark without a share when the number of questions is not fixed', () => {
    const faq = faqOf(
      testFaq({ ...guide, exams: [{ ...written, questionCount: null }] }, 'Canada', t),
    );
    expect(faq[0]).toEqual([
      'What score do you need to pass the Canada citizenship test?',
      'To pass the Knowledge test you need 15 correct answers.',
    ]);
  });

  it('is in the reader’s language', () => {
    const faq = faqOf(testFaq(guide, 'Canadá', es));
    expect(faq[0]).toEqual([
      '¿Cuántas preguntas tiene el examen de ciudadanía de Canadá?',
      'Knowledge test tiene 20 preguntas.',
    ]);
    expect(faq[3]![1]).toBe('El examen se hace en inglés o francés.');
  });
});

describe('topicFaq', () => {
  const topicGuide = {
    exams: [written],
    topic: { slug: 'history', name: 'History', publishedQuestions: 12 },
    country: { isoCode: 'CA', slug: 'canada', name: 'Canada', examLanguages: ['en'] },
  };

  it('starts with the topic, then the exam, then Oathly', () => {
    const faq = faqOf(topicFaq(topicGuide, 'Canada', t));
    expect(faq[0]).toEqual([
      'How can I practise History questions for the Canada citizenship test?',
      'Oathly has 12 checked practice questions on History. The sample on this page is free, ' +
        'with the answers explained; the rest are in the app.',
    ]);
    expect(faq.map(([question]) => question).slice(1)).toEqual([
      'How many questions are on the Canada citizenship test?',
      'What score do you need to pass the Canada citizenship test?',
      'How long does the Canada citizenship test take?',
      'What language is the Canada citizenship test in?',
      'Where do these practice questions come from?',
      'Is Oathly an official government website?',
    ]);
  });

  it('does not promise more in the app when the page shows the only question', () => {
    const one = { ...topicGuide, topic: { ...topicGuide.topic, publishedQuestions: 1 } };
    expect(faqOf(topicFaq(one, 'Canada', t))[0]![1]).toBe(
      'Oathly has 1 checked practice question on History. The sample on this page is free, ' +
        'with the answer explained.',
    );
  });
});

describe('publicSitePages', () => {
  const pages: TestPages[] = [
    {
      isoCode: 'CA',
      slug: 'canada',
      lastVerifiedAt: '2026-09-04T00:00:00.000Z',
      topics: [
        { slug: 'history', lastVerifiedAt: '2026-09-04T00:00:00.000Z' },
        { slug: 'rights', lastVerifiedAt: '2026-09-02T00:00:00.000Z' },
      ],
    },
    { isoCode: 'DE', slug: 'germany', lastVerifiedAt: null, topics: [] },
  ];

  it('lists the landing page, the country list, and every country and topic page', () => {
    expect(publicSitePages(pages)).toEqual([
      // The lists change when any country does.
      { path: '/', lastModified: '2026-09-04T00:00:00.000Z' },
      { path: '/countries', lastModified: '2026-09-04T00:00:00.000Z' },
      { path: '/canada/citizenship-test', lastModified: '2026-09-04T00:00:00.000Z' },
      { path: '/canada/citizenship-test/history', lastModified: '2026-09-04T00:00:00.000Z' },
      { path: '/canada/citizenship-test/rights', lastModified: '2026-09-02T00:00:00.000Z' },
      { path: '/germany/citizenship-test', lastModified: null },
    ]);
  });

  it('still lists the fixed pages before any country is covered', () => {
    expect(publicSitePages([])).toEqual([
      { path: '/', lastModified: null },
      { path: '/countries', lastModified: null },
    ]);
  });
});
