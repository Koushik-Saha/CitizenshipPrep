// What the API returns, as zod/mini schemas: the client checks every response
// against these, so a server that drifts fails loudly instead of rendering
// nonsense. The `satisfies` clauses keep each schema in step with its type.

import { examBlueprintSchema, examOutcomes, type QueuedAnswer } from '@oathly/core';
import * as z from 'zod/mini';

import type { CountryFacts } from './countries';
import type { CountryPack, OfflineAttempt } from './pack';
import type { Dashboard, SessionResult, StartSessionRequest, StudySession } from './study';

const nullableNumber = z.nullable(z.number());
const nullableString = z.nullable(z.string());

export const countryFactsSchema = z.object({
  isoCode: z.string(),
  slug: z.string(),
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
      // Defaulted, so a dashboard a phone saved before results existed still reads.
      examResult: z._default(z.nullable(z.enum(examOutcomes)), null),
      askExamResult: z._default(z.boolean(), false),
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

// What clients send. Every request body and every id in a path is checked
// against one of these before anything else looks at it.

/**
 * An id in a path or a body: shaped like a UUID, so it is safe to hand to
 * Postgres as one. Any version: ids come from Postgres, from phones and from
 * fixtures, and all that matters here is the shape.
 */
export const idSchema = z.guid();

/** A country as clients name it: two letters, either case. */
export const countryCodeSchema = z.string().check(z.regex(/^[A-Za-z]{2}$/));

export const startSessionRequestSchema = z.union([
  z.object({
    kind: z.enum(['practice', 'flashcards']),
    countryCode: countryCodeSchema,
    focus: z.union([z.literal('adaptive'), z.literal('random'), z.object({ topicId: idSchema })]),
    size: z.int().check(z.minimum(1), z.maximum(100)),
  }),
  z.object({
    kind: z.literal('mock_exam'),
    countryCode: countryCodeSchema,
    examFormatId: idSchema,
  }),
]) satisfies z.ZodMiniType<StartSessionRequest>;

/**
 * One answer from a client's queue. Checked one at a time, not as a batch: a
 * malformed answer is refused for good while the rest are stored.
 */
export const queuedAnswerSchema = z.object({
  clientEventId: z.guid({ error: 'clientEventId must be a UUID.' }),
  attemptId: z.guid({ error: 'Unknown attempt or question.' }),
  questionId: z.guid({ error: 'Unknown attempt or question.' }),
  questionVersion: z
    .int({ error: 'Invalid question version.' })
    .check(z.minimum(1, { error: 'Invalid question version.' })),
  selectedKeys: z
    .array(z.string().check(z.maxLength(40)), { error: 'Invalid answer.' })
    .check(z.maxLength(20, { error: 'Invalid answer.' })),
  correct: z.boolean({ error: 'Invalid answer.' }),
  timeMs: z
    .int({ error: 'Invalid answer time.' })
    .check(z.minimum(0, { error: 'Invalid answer time.' })),
  answeredAt: z
    .string({ error: 'Invalid answer timestamp.' })
    .check(
      z.refine((value) => !Number.isNaN(Date.parse(value)), { error: 'Invalid answer timestamp.' }),
    ),
}) satisfies z.ZodMiniType<QueuedAnswer>;

/** The envelope answers arrive in. Each answer is then checked on its own. */
export const answersRequestSchema = z.object({
  answers: z.array(z.unknown()).check(z.maxLength(100)),
});

export const explainRequestSchema = z.object({ questionId: idSchema });

/** The tutor's request. The conversation itself is tidied by the tutor (cleanConversation). */
export const tutorRequestSchema = z.object({
  countryCode: countryCodeSchema,
  messages: z.array(z.unknown()).check(z.maxLength(200)),
});

export const timeZoneRequestSchema = z.object({
  timeZone: z.string().check(z.minLength(1), z.maxLength(64)),
});

export const examResultRequestSchema = z.object({
  countryCode: countryCodeSchema,
  result: z.enum(examOutcomes),
});

export const sessionResultSchema = z.object({
  correct: z.int().check(z.minimum(0), z.maximum(1000)),
  total: z.int().check(z.minimum(0), z.maximum(1000)),
  passed: z.nullable(z.boolean()),
}) satisfies z.ZodMiniType<SessionResult>;

export const offlineAttemptsSchema = z.object({
  attempts: z
    .array(
      z.object({
        attemptId: idSchema,
        countryCode: countryCodeSchema,
        mode: modeSchema,
        questionIds: z.array(idSchema).check(z.maxLength(500)),
        examFormatId: z.nullable(idSchema),
        examQuestionIds: z.nullable(z.array(idSchema).check(z.maxLength(500))),
        startedAt: z.string(),
        result: z.nullable(sessionResultSchema),
      }) satisfies z.ZodMiniType<OfflineAttempt>,
    )
    .check(z.maxLength(50)),
});
