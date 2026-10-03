// The engine's view of the content. Apps map database rows onto these.

export type QuestionType = 'multiple_choice' | 'multi_select' | 'true_false' | 'free_response';

export interface QuizQuestion {
  id: string;
  topicId: string;
  /** Used by exam blueprints, which name topics by slug. */
  topicSlug: string;
  difficulty: number;
  type: QuestionType;
  correctKeys: readonly string[];
  /** Set for sub-national questions, e.g. a German Bundesland (ISO 3166-2). */
  regionCode: string | null;
  version: number;
}

export interface Answer {
  questionId: string;
  selectedKeys: readonly string[];
  timeMs: number;
  answeredAt: Date;
}

/** One answer as stored: the history the mastery model learns from. */
export interface AnswerEvent {
  questionId: string;
  correct: boolean;
  timeMs: number;
  answeredAt: Date;
}
