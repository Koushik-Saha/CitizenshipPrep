// Typed data access: Supabase queries and Claude API calls.

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
