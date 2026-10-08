import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ContentModel, DraftRequest } from './claude';
import { createPool } from './db';
import { checkSources } from './pipeline/check-sources';
import { draftQuestions } from './pipeline/draft';
import { ingestSource } from './pipeline/ingest';
import { translateQuestions } from './pipeline/translate';
import { upsertCountry } from './repository';
import {
  approveQuestion,
  approveTranslation,
  ensureReviewer,
  getQuestionForReview,
  getQueueCounts,
  getTopicCoverage,
  listQuestionQueue,
  listTranslationQueue,
  rejectQuestion,
  reverifyQuestion,
  ReviewError,
} from './review';
import type { DraftQuestion } from './schemas';
import type { LoadedSource } from './source';

// Runs the whole pipeline against a real database with a stand-in for Claude.
// Needs the local database (`pnpm db:start`); skipped when the URL is not set.
const url = process.env.TEST_DATABASE_URL;

const COUNTRY = 'ZY';
const SOURCE_URL = 'https://example.test/guide';
const REVIEWER = { id: 'test-reviewer-content', displayName: 'Test Reviewer' };

const GOVERNMENT =
  'The Constitution is the supreme law of the land. It sets up the government, defines its powers, and protects the basic rights of everyone living in the country. It was written in 1787 by delegates who met in the capital.';
const HISTORY =
  'The first President was elected in 1789. The capital city was founded the following year, and the national parliament has met there ever since. The parliament has two chambers.';
const HISTORY_REVISED =
  'The first President was elected in 1790. The capital city was founded the following year, and the national parliament has met there ever since. The parliament has two chambers.';

const guide = (history: string): LoadedSource => ({
  mediaType: 'text/plain',
  bytes: new TextEncoder().encode(
    `System of Government\n\n${GOVERNMENT}\n\nHistory\n\n${history}\n`,
  ),
});

function draft(text: string, quote: string, correct: 'a' | 'b' = 'a'): DraftQuestion {
  return {
    text,
    options: { a: 'First answer', b: 'Second answer', c: 'Third answer', d: 'Fourth answer' },
    correct,
    explanation: 'The passage states this directly.',
    source_quote: quote,
    topic: { slug: 'government', name: 'Government' },
    difficulty: 2,
  };
}

const fakeModel: ContentModel = {
  name: 'fake-model',
  async draftQuestions(request: DraftRequest) {
    if (request.passageHeading === 'System of Government') {
      return [
        draft(
          'What is the supreme law of the land?',
          'The Constitution is the supreme law of the land.',
        ),
        // Invented citation: must be discarded.
        draft('Who wrote the Constitution?', 'It was written by forty delegates.'),
      ];
    }
    return [
      draft(
        'In which year was the first President elected?',
        'The first President was elected in 1789.',
        'b',
      ),
      // Same wording as a question saved from the first passage: must be skipped.
      draft('What is the supreme law of the land?', 'The parliament has two chambers.'),
      // Reworded: saved, but flagged for the reviewer.
      draft('What is the supreme law of our land?', 'The parliament has two chambers.'),
    ];
  },
  async translate(request) {
    return {
      text: `[${request.targetLocale}] ${request.text}`,
      options: request.options.map((option) => ({
        ...option,
        text: `[${request.targetLocale}] ${option.text}`,
      })),
      explanation: `[${request.targetLocale}] ${request.explanation ?? ''}`,
    };
  },
};

describe.skipIf(!url)('content pipeline against the database', () => {
  let pool: pg.Pool;
  let documentId: string;
  let lawId: string;
  let presidentId: string;
  let rewordedId: string;

  async function cleanUp() {
    await pool.query('delete from public.questions where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.source_documents where country_code = $1', [COUNTRY]);
    await pool.query('delete from public.countries where iso_code = $1', [COUNTRY]);
    await pool.query('delete from public.profiles where id like $1', ['test-%-content']);
  }

  beforeAll(async () => {
    pool = createPool(url);
    await cleanUp();
    await upsertCountry(pool, {
      isoCode: COUNTRY,
      name: 'Testland',
      hasExam: true,
      examLanguages: ['en'],
      latitude: -35,
      longitude: -120,
    });
    await ensureReviewer(pool, REVIEWER, 'reviewer');
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  it('keeps a country’s coordinates when it is saved again without them', async () => {
    await upsertCountry(pool, {
      isoCode: COUNTRY,
      name: 'Testland',
      hasExam: true,
      examLanguages: ['en'],
    });
    const { rows } = await pool.query<{ latitude: string; longitude: string }>(
      'select latitude, longitude from public.countries where iso_code = $1',
      [COUNTRY],
    );
    expect(rows[0]).toEqual({ latitude: '-35.0000', longitude: '-120.0000' });
  });

  it('stores a guide as passages, and recognises it when ingested again', async () => {
    const input = {
      countryCode: COUNTRY,
      title: 'Testland Study Guide',
      publisher: 'Testland Ministry',
      sourceUrl: SOURCE_URL,
      locale: 'en',
      license: 'public-domain',
      isRefetchable: true,
      source: guide(HISTORY),
    };
    const first = await ingestSource(pool, input);
    expect(first).toMatchObject({ outcome: 'new', passagesAdded: 2 });
    documentId = first.documentId;

    const again = await ingestSource(pool, input);
    expect(again).toMatchObject({ documentId, outcome: 'unchanged', passagesAdded: 0 });
  });

  it('saves checked drafts, discards bad citations and handles duplicates', async () => {
    const summary = await draftQuestions(pool, fakeModel, {
      documentId,
      limit: 20,
      minPassageChars: 50,
    });
    expect(summary).toMatchObject({
      passagesRead: 2,
      saved: 3,
      exactDuplicates: 1,
      possibleDuplicates: 1,
    });
    expect(summary.discarded).toEqual([
      {
        question: 'Who wrote the Constitution?',
        problems: ['source quote does not appear in the passage'],
      },
    ]);

    const queue = await listQuestionQueue(pool, 'pending', COUNTRY);
    expect(queue.map((question) => question.text)).toEqual([
      'What is the supreme law of the land?',
      'In which year was the first President elected?',
      'What is the supreme law of our land?',
    ]);
    expect(queue.every((question) => question.status === 'draft' && question.hasSource)).toBe(true);
    expect(queue.map((question) => question.isPossibleDuplicate)).toEqual([false, false, true]);
    [lawId, presidentId, rewordedId] = queue.map((question) => question.id) as [
      string,
      string,
      string,
    ];

    expect(await getQueueCounts(pool, COUNTRY)).toEqual({
      questions: 3,
      translations: 0,
      sourceChanged: 0,
      published: 0,
    });

    // By topic, for holding against the guide's contents: every draft is
    // counted once, under a topic, and nothing is published or translated yet.
    const coverage = await getTopicCoverage(pool, COUNTRY);
    expect(coverage.length).toBeGreaterThan(0);
    expect(coverage.reduce((sum, topic) => sum + topic.waiting, 0)).toBe(3);
    expect(coverage.every((topic) => topic.published === 0)).toBe(true);
    expect(coverage.every((topic) => topic.translatedInto.length === 0)).toBe(true);
    expect(await getTopicCoverage(pool, 'QQ')).toEqual([]);
  });

  it('does not draft twice from passages that already have questions', async () => {
    const summary = await draftQuestions(pool, fakeModel, {
      documentId,
      limit: 20,
      minPassageChars: 50,
    });
    expect(summary).toMatchObject({ passagesRead: 0, saved: 0 });
  });

  it('shows the reviewer the question beside its source passage', async () => {
    const question = await getQuestionForReview(pool, presidentId);
    expect(question).toMatchObject({
      status: 'draft',
      correctKeys: ['b'],
      sourceQuote: 'The first President was elected in 1789.',
      draftedByModel: 'fake-model',
      sourceUrl: SOURCE_URL,
      passage: {
        documentTitle: 'Testland Study Guide',
        heading: 'History',
        text: HISTORY,
        isCurrent: true,
      },
      original: { locale: 'en', status: 'draft', translatedFrom: null },
    });
    const reworded = await getQuestionForReview(pool, rewordedId);
    expect(reworded?.duplicateOf).toMatchObject({
      id: lawId,
      text: 'What is the supreme law of the land?',
    });
  });

  it('publishes an approved question with its verification stamp', async () => {
    await approveQuestion(pool, presidentId, REVIEWER.id);
    const question = await getQuestionForReview(pool, presidentId);
    expect(question).toMatchObject({
      status: 'published',
      verifiedBy: 'Test Reviewer',
      original: { status: 'approved' },
    });
    expect(question?.lastVerifiedAt).toBeInstanceOf(Date);
    expect(question?.history.map((entry) => entry.action)).toEqual(['approved']);
    await expect(approveQuestion(pool, presidentId, REVIEWER.id)).rejects.toThrow(ReviewError);
  });

  it('saves the reviewer’s edits when approving', async () => {
    const before = await getQuestionForReview(pool, lawId);
    await approveQuestion(pool, lawId, REVIEWER.id, {
      text: 'Which document is the supreme law of the land?',
      options: before!.original.options,
      correctKey: 'a',
      explanation: 'The guide says the Constitution is the supreme law of the land.',
      topicId: before!.topicId,
      difficulty: 1,
    });
    const after = await getQuestionForReview(pool, lawId);
    expect(after).toMatchObject({
      status: 'published',
      difficulty: 1,
      original: { text: 'Which document is the supreme law of the land?' },
    });
  });

  it('rejects a draft only with a reason, and keeps it', async () => {
    await expect(rejectQuestion(pool, rewordedId, REVIEWER.id, '  ')).rejects.toThrow(ReviewError);
    await rejectQuestion(pool, rewordedId, REVIEWER.id, 'Duplicate of an existing question.');
    const question = await getQuestionForReview(pool, rewordedId);
    expect(question?.status).toBe('rejected');
    expect(question?.history[0]).toMatchObject({
      action: 'rejected',
      note: 'Duplicate of an existing question.',
    });
    expect((await getQueueCounts(pool, COUNTRY)).questions).toBe(0);
  });

  it('refuses decisions from someone who is not staff', async () => {
    await pool.query(
      `insert into public.profiles (id, display_name) values ('test-learner-content', 'Learner')`,
    );
    await expect(reverifyQuestion(pool, lawId, 'test-learner-content')).rejects.toThrow(
      'Only reviewers and admins can review content.',
    );
  });

  it('drafts translations of published questions, which then need review', async () => {
    const summary = await translateQuestions(pool, fakeModel, {
      countryCode: COUNTRY,
      locales: ['es'],
    });
    expect(summary).toEqual({ saved: 2, discarded: [] });

    const queue = await listTranslationQueue(pool, COUNTRY);
    expect(queue).toHaveLength(2);
    expect(queue[0]).toMatchObject({ locale: 'es', translatedFrom: 'en' });

    // Running it again finds nothing left to translate.
    expect(
      (await translateQuestions(pool, fakeModel, { countryCode: COUNTRY, locales: ['es'] })).saved,
    ).toBe(0);

    const target = queue.find((entry) => entry.questionId === presidentId)!;
    const question = await getQuestionForReview(pool, target.questionId);
    const spanish = question!.translations.find((wording) => wording.locale === 'es')!;
    expect(spanish.status).toBe('draft');

    await approveTranslation(pool, presidentId, 'es', REVIEWER.id, {
      text: '¿En qué año fue elegido el primer presidente?',
      options: spanish.options,
      explanation: 'El pasaje lo dice directamente.',
    });
    const approved = await getQuestionForReview(pool, presidentId);
    expect(approved!.translations.find((wording) => wording.locale === 'es')).toMatchObject({
      status: 'approved',
      text: '¿En qué año fue elegido el primer presidente?',
    });
    expect((await getQueueCounts(pool, COUNTRY)).translations).toBe(1);
  });

  it('flags the questions that cite a passage which changed in the source', async () => {
    const unchanged = await checkSources(pool, {
      countryCode: COUNTRY,
      fetch: async () => guide(HISTORY),
    });
    expect(unchanged[0]?.update?.outcome).toBe('unchanged');

    const [result] = await checkSources(pool, {
      countryCode: COUNTRY,
      fetch: async () => guide(HISTORY_REVISED),
    });
    expect(result?.update).toMatchObject({
      outcome: 'changed',
      passagesRemoved: 1,
      passagesAdded: 1,
      questionsFlagged: 1,
    });

    const flagged = await listQuestionQueue(pool, 'source-changed', COUNTRY);
    expect(flagged.map((question) => question.id)).toEqual([presidentId]);
    const question = await getQuestionForReview(pool, presidentId);
    // The reviewer still sees the passage the question was written from.
    expect(question?.passage).toMatchObject({ text: HISTORY, isCurrent: false });
    expect(question?.status).toBe('published');

    await reverifyQuestion(pool, presidentId, REVIEWER.id, 'Checked against the new edition.');
    expect((await getQueueCounts(pool, COUNTRY)).sourceChanged).toBe(0);
  });

  it('reports a source that cannot be fetched without touching it', async () => {
    const [result] = await checkSources(pool, {
      countryCode: COUNTRY,
      fetch: async () => {
        throw new Error('HTTP 503');
      },
    });
    expect(result).toMatchObject({ error: 'HTTP 503' });
    expect(result?.update).toBeUndefined();
  });
});
