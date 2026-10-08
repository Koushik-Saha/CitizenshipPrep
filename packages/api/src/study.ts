import type { ClipPart, ExamOutcome, MockExam, MockExamSection, QuizQuestion } from '@oathly/core';

// What a study session looks like on the client: everything needed to run it
// without another request.

export type StudyMode = 'practice' | 'flashcards' | 'mock_exam';

/**
 * The recorded clips of a wording being read aloud, for audio mode: a clip's
 * id for each part, or null where none has been recorded and the app reads
 * that part with the device's own voice.
 */
export type WordingAudio = Record<ClipPart, string | null>;

/** A question's words in one language. */
export interface QuestionWording {
  /** The language this wording is in. */
  locale: string;
  text: string;
  options: { key: string; text: string }[];
  explanation: string | null;
  audio: WordingAudio;
}

export interface SessionQuestion {
  id: string;
  version: number;
  topicId: string;
  topicName: string;
  type: 'multiple_choice' | 'multi_select' | 'true_false' | 'free_response';
  /** The language this wording is in. */
  locale: string;
  text: string;
  options: { key: string; text: string }[];
  correctKeys: string[];
  explanation: string | null;
  /** Recordings of the wording above. */
  audio: WordingAudio;
  /** The words in the official guide the answer rests on. */
  sourceQuote: string | null;
  sourceUrl: string;
  /**
   * The same question as the exam words it, when the wording above is a
   * translation into the learner's study language. Null when the wording
   * above already is the exam's.
   */
  original: QuestionWording | null;
}

/**
 * The wording to show: the learner's study language, or the exam's own
 * language if they have asked for that and the two differ.
 */
export function questionWording(
  question: SessionQuestion,
  inExamLanguage: boolean,
): QuestionWording {
  return inExamLanguage && question.original
    ? question.original
    : {
        locale: question.locale,
        text: question.text,
        options: question.options,
        explanation: question.explanation,
        audio: question.audio,
      };
}

export interface SessionExam {
  name: string;
  questionCount: number;
  passMark: number | null;
  timeLimitMs: number | null;
  stopEarly: boolean;
  /**
   * The real exam is spoken: an examiner asks each question aloud and the
   * candidate answers aloud. The apps run it as a mock interview.
   */
  spoken: boolean;
  sections: MockExamSection[];
}

/** Whether an exam of this kind is asked and answered aloud. */
export function isSpokenFormat(formatType: string): boolean {
  return formatType === 'oral' || formatType === 'interview';
}

/** Where a recorded clip is served from, given the web app's address. */
export function audioClipUrl(baseUrl: string, clipId: string): string {
  return `${baseUrl.replace(/\/$/, '')}/api/audio/${clipId}`;
}

export interface StudySession {
  attemptId: string;
  countryCode: string;
  countryName: string;
  /** Where the country sits on the globe, if set. */
  countryLocation: { latitude: number; longitude: number } | null;
  mode: StudyMode;
  startedAt: string;
  completedAt: string | null;
  questions: SessionQuestion[];
  exam: SessionExam | null;
}

export interface TopicReadiness {
  topicId: string;
  name: string;
  questions: number;
  /** 0 to 100. */
  mastery: number;
}

export interface ExamOption {
  id: string;
  name: string;
  questionCount: number;
  timeLimitMinutes: number | null;
  passMark: number | null;
  isCurrent: boolean;
  /** Asked and answered aloud in the real exam: offered as a mock interview. */
  spoken: boolean;
  /** Why a mock exam cannot be built yet, if it cannot. */
  unavailableReason: string | null;
  /** It cannot be built from the Free plan's sample, but could with all the questions. */
  locked: boolean;
}

export type StudySuggestionView =
  | { kind: 'start' }
  | { kind: 'review'; count: number }
  | { kind: 'topic'; topicId: string; name: string; share: number; mastery: number }
  | { kind: 'mock'; examFormatId: string; examName: string };

export interface ReadinessView {
  /** 0 to 100: an estimate, never a promise. */
  score: number;
  /** Too little practice yet for the score to mean much. */
  isEarlyEstimate: boolean;
  /** Topic mastery weighted by each topic's share of the exam, 0 to 100. */
  knowledge: number;
  /** Recent mock exams, recency-weighted, 0 to 100; null without any. */
  mockAverage: number | null;
  questionsSeen: number;
  /** The exam the score is measured against. */
  examName: string | null;
  /** Largest gap first. Share and mastery are 0 to 100. */
  topics: { topicId: string; name: string; share: number; mastery: number }[];
  suggestions: StudySuggestionView[];
}

export interface CountryDashboard {
  countryCode: string;
  countryName: string;
  isPrimary: boolean;
  examDate: string | null;
  /** How the real exam went, once the learner has said. */
  examResult: ExamOutcome | null;
  /** Whether to ask how it went: the date has come and they have not said. */
  askExamResult: boolean;
  /** Null when no questions are published yet. */
  readiness: ReadinessView | null;
  /** Questions this learner can study: all of them, or the Free plan's sample. */
  publishedQuestions: number;
  /** Every published question the country has. */
  totalQuestions: number;
  /** Whether the learner's plan opens all of them (Pro, or this country's pass). */
  fullAccess: boolean;
  /** For choosing a topic to practise. */
  topics: TopicReadiness[];
  exams: ExamOption[];
  dueForReview: number;
}

export interface Dashboard {
  streakDays: number;
  minutesToday: number;
  dailyGoalMinutes: number;
  countries: CountryDashboard[];
}

/** What a client sends to start a session. */
export type StartSessionRequest =
  | {
      kind: 'practice' | 'flashcards';
      countryCode: string;
      /** Weak topics and reviews, anything at random, or one topic. */
      focus: 'adaptive' | 'random' | { topicId: string };
      size: number;
    }
  | { kind: 'mock_exam'; countryCode: string; examFormatId: string };

/** How the session finished, as the client scored it. */
export interface SessionResult {
  correct: number;
  total: number;
  /** For a mock exam: whether it was a pass. */
  passed: boolean | null;
}

/** A session question as the quiz engine wants it. */
export function toQuizQuestion(question: SessionQuestion): QuizQuestion {
  return {
    id: question.id,
    topicId: question.topicId,
    // The engine only uses slugs to build exams; a running session has its
    // sections already, so the id stands in.
    topicSlug: question.topicId,
    difficulty: 1,
    type: question.type,
    correctKeys: question.correctKeys,
    regionCode: null,
    version: question.version,
  };
}

/** The session's exam as the quiz engine wants it; null for practice and flashcards. */
export function toMockExam(session: StudySession): MockExam | null {
  if (!session.exam) return null;
  return {
    formatId: session.attemptId,
    questionIds: session.questions.map((question) => question.id),
    sections: session.exam.sections,
    questionCount: session.exam.questionCount,
    passMark: session.exam.passMark,
    timeLimitMs: session.exam.timeLimitMs,
    stopEarly: session.exam.stopEarly,
  };
}
