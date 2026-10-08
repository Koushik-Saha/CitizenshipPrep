import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { NEAR_DUPLICATE_THRESHOLD, similarity } from './duplicates';
import { questionRecordSchema, type QuestionRecord } from './records';

// Counting a country's question files against their targets, and pointing at
// questions worded alike. Wording is all this can compare: two questions that
// ask the same thing in different words still need a reader to catch them.

/** Difficulty 1-5 as the three bands targets are set in. */
export function difficultyBand(difficulty: number): 'easy' | 'medium' | 'hard' {
  if (difficulty <= 2) return 'easy';
  return difficulty === 3 ? 'medium' : 'hard';
}

export interface QuestionStats {
  total: number;
  byFile: Record<string, number>;
  byTopic: Record<string, number>;
  byBand: Record<string, number>;
  byType: Record<string, number>;
  byStyle: Record<string, number>;
  byOrigin: Record<string, number>;
  byStatus: Record<string, number>;
  freshnessChecks: number;
  /** Pairs worded alike, most alike first. */
  alike: { a: string; b: string; score: number; text: string }[];
}

/** Every valid question in data/questions/<ISO>/, with the file it is in. */
export function readQuestions(
  dataDir: string,
  iso: string,
): { file: string; question: QuestionRecord }[] {
  const folder = path.join(dataDir, 'questions', iso);
  if (!existsSync(folder)) return [];
  const found: { file: string; question: QuestionRecord }[] = [];
  for (const file of readdirSync(folder).sort()) {
    if (!file.endsWith('.json')) continue;
    const value: unknown = JSON.parse(readFileSync(path.join(folder, file), 'utf8'));
    for (const record of Array.isArray(value) ? value : [value]) {
      const parsed = questionRecordSchema.safeParse(record);
      if (parsed.success) found.push({ file, question: parsed.data });
    }
  }
  return found;
}

export function questionStats(dataDir: string, iso: string): QuestionStats {
  const questions = readQuestions(dataDir, iso);
  const stats: QuestionStats = {
    total: questions.length,
    byFile: {},
    byTopic: {},
    byBand: {},
    byType: {},
    byStyle: {},
    byOrigin: {},
    byStatus: {},
    freshnessChecks: 0,
    alike: [],
  };
  const count = (record: Record<string, number>, key: string) => {
    record[key] = (record[key] ?? 0) + 1;
  };
  for (const { file, question } of questions) {
    count(stats.byFile, file);
    count(stats.byTopic, question.topic);
    count(stats.byBand, difficultyBand(question.difficulty));
    count(stats.byType, question.type);
    count(stats.byStyle, question.style);
    count(stats.byOrigin, question.origin);
    count(stats.byStatus, question.status);
    if (question.needs_freshness_check) stats.freshnessChecks += 1;
  }
  for (let i = 0; i < questions.length; i += 1) {
    for (let j = i + 1; j < questions.length; j += 1) {
      const a = questions[i]!.question;
      const b = questions[j]!.question;
      // The same question for two regions is not a duplicate.
      if (a.region !== b.region) continue;
      const score = similarity(a.question, b.question);
      if (score >= NEAR_DUPLICATE_THRESHOLD) {
        stats.alike.push({
          a: a.id,
          b: b.id,
          score: Math.round(score * 100) / 100,
          text: a.question,
        });
      }
    }
  }
  stats.alike.sort((x, y) => y.score - x.score);
  return stats;
}
