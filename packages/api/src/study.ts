import type { MockExamSection } from '@oathly/core';

// What a study session looks like on the client: everything needed to run it
// without another request.

export type StudyMode = 'practice' | 'flashcards' | 'mock_exam';

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
  /** The words in the official guide the answer rests on. */
  sourceQuote: string | null;
  sourceUrl: string;
}

export interface SessionExam {
  name: string;
  questionCount: number;
  passMark: number | null;
  timeLimitMs: number | null;
  stopEarly: boolean;
  sections: MockExamSection[];
}

export interface StudySession {
  attemptId: string;
  countryCode: string;
  countryName: string;
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
  /** Why a mock exam cannot be built yet, if it cannot. */
  unavailableReason: string | null;
}

export interface CountryDashboard {
  countryCode: string;
  countryName: string;
  isPrimary: boolean;
  examDate: string | null;
  /** 0 to 100, or null when no questions are published yet. */
  readiness: number | null;
  publishedQuestions: number;
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
