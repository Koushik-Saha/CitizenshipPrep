// Typed data access shared by the web and mobile apps. Safe to import anywhere;
// database access lives in ./server.

// database.types.ts is generated from the local database: `pnpm db:types`.
export { Constants } from './database.types';
export type { Database, Enums, Json, Tables, TablesInsert, TablesUpdate } from './database.types';

/** One entry of `question_translations.options`. */
export interface QuestionOption {
  key: string;
  text: string;
}

/** Shape of `questions.correct_answer`: the keys of the correct options. */
export interface CorrectAnswer {
  keys: string[];
}

export * from './billing';
export * from './client';
export * from './countries';
export * from './me';
export * from './onboarding';
export * from './outbox';
export * from './pack';
export * from './session';
export * from './study';
