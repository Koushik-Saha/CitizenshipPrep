// What the API returns, as zod/mini schemas: the client checks every response
// against these, so a server that drifts fails loudly instead of rendering
// nonsense. The `satisfies` clauses keep each schema in step with its type.

import { examBlueprintSchema } from '@oathly/core';
import * as z from 'zod/mini';

import type { CountryFacts } from './countries';
import type { CountryPack, OfflineAttempt } from './pack';
import type { Dashboard, SessionResult, StartSessionRequest, StudySession } from './study';

const nullableNumber = z.nullable(z.number());
const nullableString = z.nullable(z.string());

export const countryFactsSchema = z.object({
  isoCode: z.string(),
  name: z.string(),
  examLanguages: z.array(z.string()),
  latitude: nullableNumber,
  longitude: nullableNumber,
  exams: z.array(
    z.object({
      name: z.string(),
      formatType: z.enum(['written', 'oral', 'interview', 'language']),
      questionCount: nullableNumber,
      passMark: nullableNumber,
      timeLimitMinutes: nullableNumber,
      sourceUrl: z.string(),
      lastVerifiedAt: nullableString,
    }),
  ),
  publishedQuestions: z.number(),
}) satisfies z.ZodMiniType<CountryFacts>;

const suggestionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('start') }),
  z.object({ kind: z.literal('review'), count: z.number() }),
  z.object({
    kind: z.literal('topic'),
    topicId: z.string(),
    name: z.string(),
    share: z.number(),
    mastery: z.number(),
  }),
  z.object({ kind: z.literal('mock'), examFormatId: z.string(), examName: z.string() }),
]);

const readinessSchema = z.object({
  score: z.number(),
  isEarlyEstimate: z.boolean(),
  knowledge: z.number(),
  mockAverage: nullableNumber,
  questionsSeen: z.number(),
  examName: nullableString,
  topics: z.array(
    z.object({ topicId: z.string(), name: z.string(), share: z.number(), mastery: z.number() }),
  ),
  suggestions: z.array(suggestionSchema),
});

export const dashboardSchema = z.object({
  streakDays: z.number(),
  minutesToday: z.number(),
  dailyGoalMinutes: z.number(),
  countries: z.array(
    z.object({
      countryCode: z.string(),
      countryName: z.string(),
      isPrimary: z.boolean(),
      examDate: nullableString,
      readiness: z.nullable(readinessSchema),
      publishedQuestions: z.number(),
      totalQuestions: z.number(),
      fullAccess: z.boolean(),
      topics: z.array(
        z.object({
          topicId: z.string(),
          name: z.string(),
          questions: z.number(),
          mastery: z.number(),
        }),
      ),
      exams: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          questionCount: z.number(),
          timeLimitMinutes: nullableNumber,
          passMark: nullableNumber,
          isCurrent: z.boolean(),
          spoken: z.boolean(),
          unavailableReason: nullableString,
          locked: z.boolean(),
        }),
      ),
      dueForReview: z.number(),
    }),
  ),
}) satisfies z.ZodMiniType<Dashboard>;

const locationSchema = z.nullable(z.object({ latitude: z.number(), longitude: z.number() }));
const modeSchema = z.enum(['practice', 'flashcards', 'mock_exam']);

const audioSchema = z.object({
  question: nullableString,
  options: nullableString,
  answer: nullableString,
  explanation: nullableString,
});

const questionShape = {
  id: z.string(),
  version: z.number(),
  topicId: z.string(),
  topicName: z.string(),
  type: z.enum(['multiple_choice', 'multi_select', 'true_false', 'free_response']),
  locale: z.string(),
  text: z.string(),
  options: z.array(z.object({ key: z.string(), text: z.string() })),
  correctKeys: z.array(z.string()),
  explanation: nullableString,
  audio: audioSchema,
  sourceQuote: nullableString,
  sourceUrl: z.string(),
  original: z.nullable(
    z.object({
      locale: z.string(),
      text: z.string(),
      options: z.array(z.object({ key: z.string(), text: z.string() })),
      explanation: nullableString,
      audio: audioSchema,
    }),
  ),
};

export const studySessionSchema = z.object({
  attemptId: z.string(),
  countryCode: z.string(),
  countryName: z.string(),
  countryLocation: locationSchema,
  mode: modeSchema,
  startedAt: z.string(),
  completedAt: nullableString,
  questions: z.array(z.object(questionShape)),
  exam: z.nullable(
    z.object({
      name: z.string(),
      questionCount: z.number(),
      passMark: nullableNumber,
      timeLimitMs: nullableNumber,
      stopEarly: z.boolean(),
      spoken: z.boolean(),
      sections: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          questionIds: z.array(z.string()),
          mustAllBeCorrect: z.boolean(),
        }),
      ),
    }),
  ),
}) satisfies z.ZodMiniType<StudySession>;

export const countryPackSchema = z.object({
  countryCode: z.string(),
  countryName: z.string(),
  countryLocation: locationSchema,
  generatedAt: z.string(),
  examFormats: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      questionCount: nullableNumber,
      passMark: nullableNumber,
      timeLimitMinutes: nullableNumber,
      isCurrent: z.boolean(),
      spoken: z.boolean(),
      blueprint: examBlueprintSchema,
    }),
  ),
  questions: z.array(
    z.object({
      ...questionShape,
      topicSlug: z.string(),
      difficulty: z.number(),
      regionCode: nullableString,
    }),
  ),
  history: z.array(
    z.object({
      questionId: z.string(),
      correct: z.boolean(),
      timeMs: z.number(),
      answeredAt: z.string(),
    }),
  ),
}) satisfies z.ZodMiniType<CountryPack>;

export const syncOutcomeSchema = z.object({
  accepted: z.array(z.string()),
  rejected: z.array(
    z.object({ clientEventId: z.string(), reason: z.string(), permanent: z.boolean() }),
  ),
});

export const startedSchema = z.object({ attemptId: z.string() });

// What clients send.

export const startSessionRequestSchema = z.union([
  z.object({
    kind: z.enum(['practice', 'flashcards']),
    countryCode: z.string(),
    focus: z.union([z.literal('adaptive'), z.literal('random'), z.object({ topicId: z.string() })]),
    size: z.number(),
  }),
  z.object({ kind: z.literal('mock_exam'), countryCode: z.string(), examFormatId: z.string() }),
]) satisfies z.ZodMiniType<StartSessionRequest>;

export const sessionResultSchema = z.object({
  correct: z.number(),
  total: z.number(),
  passed: z.nullable(z.boolean()),
}) satisfies z.ZodMiniType<SessionResult>;

export const offlineAttemptsSchema = z.object({
  attempts: z
    .array(
      z.object({
        attemptId: z.string(),
        countryCode: z.string(),
        mode: modeSchema,
        questionIds: z.array(z.string()),
        examFormatId: nullableString,
        examQuestionIds: z.nullable(z.array(z.string())),
        startedAt: z.string(),
        result: z.nullable(sessionResultSchema),
      }) satisfies z.ZodMiniType<OfflineAttempt>,
    )
    .check(z.maxLength(50)),
});
