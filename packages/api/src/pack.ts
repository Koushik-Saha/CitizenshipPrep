import {
  buildMockExam,
  buildPracticeSet,
  type AnswerEvent,
  type ExamBlueprint,
  type ExamFormat,
  type QuizQuestion,
  type Random,
} from '@oathly/core';

import type {
  SessionQuestion,
  SessionResult,
  StartSessionRequest,
  StudyMode,
  StudySession,
} from './study';

// A country pack: everything a phone needs to study one country with no
// connection. Sessions are built on the device with the same quiz engine the
// server uses, then registered with the server (and their answers sent) when
// the phone is back online.

export interface PackQuestion extends SessionQuestion {
  topicSlug: string;
  difficulty: number;
  regionCode: string | null;
}

export interface PackExamFormat {
  id: string;
  name: string;
  questionCount: number | null;
  passMark: number | null;
  timeLimitMinutes: number | null;
  isCurrent: boolean;
  blueprint: ExamBlueprint;
}

export interface PackAnswer {
  questionId: string;
  correct: boolean;
  timeMs: number;
  /** ISO timestamp. */
  answeredAt: string;
}

export interface CountryPack {
  countryCode: string;
  countryName: string;
  countryLocation: { latitude: number; longitude: number } | null;
  /** ISO timestamp of when the server put the pack together. */
  generatedAt: string;
  examFormats: PackExamFormat[];
  /** Published questions only, worded in the learner's study language where a checked translation exists. */
  questions: PackQuestion[];
  /** The learner's answers so far, oldest first, so practice can adapt offline. */
  history: PackAnswer[];
}

/** A session that was started on the device and still has to reach the server. */
export interface OfflineAttempt {
  attemptId: string;
  countryCode: string;
  mode: StudyMode;
  questionIds: string[];
  /** Section by section, for a mock exam; the attempt keeps the asking order. */
  examFormatId: string | null;
  examQuestionIds: string[] | null;
  startedAt: string;
  /** Set once the learner has finished it. */
  result: SessionResult | null;
}

export class PackError extends Error {
  override readonly name = 'PackError';
}

const toEngineQuestion = (question: PackQuestion): QuizQuestion => ({
  id: question.id,
  topicId: question.topicId,
  topicSlug: question.topicSlug,
  difficulty: question.difficulty,
  type: question.type,
  correctKeys: question.correctKeys,
  regionCode: question.regionCode,
  version: question.version,
});

const toSessionQuestion = (question: PackQuestion): SessionQuestion => ({
  id: question.id,
  version: question.version,
  topicId: question.topicId,
  topicName: question.topicName,
  type: question.type,
  locale: question.locale,
  text: question.text,
  options: question.options,
  correctKeys: question.correctKeys,
  explanation: question.explanation,
  sourceQuote: question.sourceQuote,
  sourceUrl: question.sourceUrl,
  original: question.original,
});

/** The pack's stored answers plus any made since, as the engine reads them. */
export function packHistory(pack: CountryPack, since: readonly PackAnswer[] = []): AnswerEvent[] {
  return [...pack.history, ...since].map((answer) => ({
    questionId: answer.questionId,
    correct: answer.correct,
    timeMs: answer.timeMs,
    answeredAt: new Date(answer.answeredAt),
  }));
}

export interface OfflineSessionOptions {
  /** A fresh UUID for the attempt; the server keeps it when the session syncs. */
  attemptId: string;
  now: Date;
  random: Random;
  /** Answers recorded on the device since the pack was downloaded. */
  localAnswers?: readonly PackAnswer[];
}

/**
 * Starts a session from a downloaded pack, with no network: the same choices
 * the server would make (the same engine), and the record to send it later.
 */
export function startOfflineSession(
  pack: CountryPack,
  request: StartSessionRequest,
  options: OfflineSessionOptions,
): { session: StudySession; attempt: OfflineAttempt } {
  if (request.countryCode !== pack.countryCode) {
    throw new PackError('This pack is for another country.');
  }
  if (pack.questions.length === 0) {
    throw new PackError('No questions are published for this country yet.');
  }
  const pool = pack.questions.map(toEngineQuestion);
  const byId = new Map(pack.questions.map((question) => [question.id, question]));
  const startedAt = options.now.toISOString();
  const base = {
    attemptId: options.attemptId,
    countryCode: pack.countryCode,
    countryName: pack.countryName,
    countryLocation: pack.countryLocation,
    startedAt,
    completedAt: null,
  };
  const questionsFor = (ids: readonly string[]) =>
    ids.map((id) => toSessionQuestion(byId.get(id)!));

  if (request.kind === 'mock_exam') {
    const format = pack.examFormats.find((candidate) => candidate.id === request.examFormatId);
    if (!format) throw new PackError('That exam is not in this pack.');
    let exam;
    try {
      exam = buildMockExam(format satisfies ExamFormat, pool, { random: options.random });
    } catch (error) {
      throw new PackError(error instanceof Error ? error.message : String(error));
    }
    return {
      session: {
        ...base,
        mode: 'mock_exam',
        questions: questionsFor(exam.questionIds),
        exam: {
          name: format.name,
          questionCount: exam.questionCount,
          passMark: exam.passMark,
          timeLimitMs: exam.timeLimitMs,
          stopEarly: exam.stopEarly,
          sections: exam.sections,
        },
      },
      attempt: {
        attemptId: options.attemptId,
        countryCode: pack.countryCode,
        mode: 'mock_exam',
        questionIds: exam.questionIds,
        examFormatId: format.id,
        examQuestionIds: exam.sections.flatMap((section) => section.questionIds),
        startedAt,
        result: null,
      },
    };
  }

  const topicId = typeof request.focus === 'object' ? request.focus.topicId : undefined;
  let set;
  try {
    set = buildPracticeSet(pool, {
      mode: topicId ? 'topic' : (request.focus as 'adaptive' | 'random'),
      size: Math.min(Math.max(1, Math.trunc(request.size)), 100),
      topicIds: topicId ? [topicId] : undefined,
      history: packHistory(pack, options.localAnswers),
      now: options.now,
      random: options.random,
    });
  } catch (error) {
    throw new PackError(error instanceof Error ? error.message : String(error));
  }
  if (set.length === 0) throw new PackError('No questions match that choice.');
  const questionIds = set.map((question) => question.id);
  return {
    session: { ...base, mode: request.kind, questions: questionsFor(questionIds), exam: null },
    attempt: {
      attemptId: options.attemptId,
      countryCode: pack.countryCode,
      mode: request.kind,
      questionIds,
      examFormatId: null,
      examQuestionIds: null,
      startedAt,
      result: null,
    },
  };
}
