import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type pg from 'pg';

import { parseCsv } from '@oathly/core';

import { validateDataFiles } from '../data-files';
import { withTransaction } from '../db';
import { reviewColumns } from '../pack';
import { readQuestions } from '../question-stats';
import type { QuestionRecord } from '../records';
import { ensureTopic } from '../repository';
import { slugify } from '../text';

// Loads a country's question files (data/questions/<ISO>/) into the review
// queue. This is the only way a question written as a file reaches the app,
// and it stops short of publishing: every question arrives `in_review`, and a
// reviewer approves it at /admin/content like any other.
//
// Only questions the fact-check passed are loaded. Loading again updates a
// question that is still waiting, and leaves alone one a reviewer has already
// published, rejected or retired.

export interface ImportOutcome {
  /** New to the review queue. */
  added: number;
  /** Already waiting there; brought up to date with the file. */
  updated: number;
  skipped: { id: string; reason: string }[];
}

export class ImportError extends Error {
  override readonly name = 'ImportError';
}

interface Stored {
  type: QuestionRecord['type'];
  options: { key: string; text: string }[];
  correctKeys: string[];
}

const KEYS = 'abcdefghijklmnopqrstuvwxyz0123'.split('');

/** A file question's options and answer, the way the app stores them. */
export function storedAnswer(question: QuestionRecord): Stored {
  if (question.type === 'free_response') {
    // Nothing to choose from: the accepted answers are the options, and any one is right.
    const options = question.correct_answers.map((text, i) => ({ key: KEYS[i]!, text }));
    return { type: question.type, options, correctKeys: options.map((option) => option.key) };
  }
  const options = question.options.map((text, i) => ({ key: KEYS[i]!, text }));
  if (question.type === 'multi_select') {
    const right = new Set(question.correct_answers);
    return {
      type: question.type,
      options,
      correctKeys: options.filter((option) => right.has(option.text)).map((option) => option.key),
    };
  }
  return {
    type: question.type,
    options,
    correctKeys: [options[question.correct_option_index]!.key],
  };
}

/** The fact-check's verdict for each question id, from review.csv. */
function verdicts(folder: string): Map<string, string> {
  const file = path.join(folder, 'review.csv');
  if (!existsSync(file)) {
    throw new ImportError(
      'There is no review.csv: fact-check the questions first (/fact-check-questions). Only questions that pass are loaded.',
    );
  }
  const [header = [], ...rows] = parseCsv(readFileSync(file, 'utf8'));
  if (header.join(',') !== reviewColumns.join(',')) {
    throw new ImportError(`review.csv must have the columns ${reviewColumns.join(', ')}.`);
  }
  return new Map(rows.filter((row) => row[0]).map((row) => [row[0]!, row[1] ?? '']));
}

export async function importQuestionFiles(
  pool: pg.Pool,
  dataDir: string,
  iso: string,
  options: { dryRun?: boolean } = {},
): Promise<ImportOutcome> {
  const folder = path.join(dataDir, 'questions', iso);
  // Nothing malformed goes in: the whole folder has to validate first.
  const problems = validateDataFiles(dataDir).problems.filter(
    (problem) => problem.startsWith(`questions/${iso}/`) || problem.startsWith(`sources/${iso}/`),
  );
  if (problems.length > 0) {
    throw new ImportError(
      `${iso}'s files do not validate (pnpm content validate):\n  ${problems.slice(0, 10).join('\n  ')}`,
    );
  }
  const questions = readQuestions(dataDir, iso);
  if (questions.length === 0) throw new ImportError(`There are no questions in ${folder}.`);
  const verdict = verdicts(folder);

  const { rows: countries } = await pool.query(
    'select 1 from public.countries where iso_code = $1',
    [iso],
  );
  if (countries.length === 0) {
    throw new ImportError(
      `${iso} is not a country in this database yet: add it first (/add-country).`,
    );
  }

  const outcome: ImportOutcome = { added: 0, updated: 0, skipped: [] };
  const skip = (id: string, reason: string) => outcome.skipped.push({ id, reason });

  await withTransaction(pool, async (db) => {
    for (const { question } of questions) {
      const judged = verdict.get(question.id);
      if (judged !== 'pass' && judged !== 'fixed') {
        skip(question.id, judged ? `the fact-check says "${judged}"` : 'not fact-checked');
        continue;
      }
      if (question.status === 'needs_review') {
        skip(question.id, 'its source has changed: marked needs_review in the file');
        continue;
      }
      const { rows: existing } = await db.query<{ status: string }>(
        'select status from public.questions where id = $1',
        [question.id],
      );
      const status = existing[0]?.status;
      if (status && status !== 'draft' && status !== 'in_review') {
        // A reviewer has decided; the file does not overrule them.
        skip(question.id, `already ${status} in the app`);
        continue;
      }
      if (options.dryRun) {
        if (status) outcome.updated += 1;
        else outcome.added += 1;
        continue;
      }

      const stored = storedAnswer(question);
      const topicId = await ensureTopic(db, iso, {
        slug: slugify(question.topic),
        name: question.topic,
      });
      await db.query(
        `insert into public.questions
           (id, country_code, topic_id, region_code, difficulty, type, correct_answer, source_url,
            source_quote, source_locator, origin, official_number, needs_freshness_check, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'in_review')
         on conflict (id) do update set
           topic_id = excluded.topic_id, region_code = excluded.region_code,
           difficulty = excluded.difficulty, type = excluded.type,
           correct_answer = excluded.correct_answer, source_url = excluded.source_url,
           source_quote = excluded.source_quote, source_locator = excluded.source_locator,
           origin = excluded.origin, official_number = excluded.official_number,
           needs_freshness_check = excluded.needs_freshness_check, status = 'in_review'`,
        [
          question.id,
          iso,
          topicId,
          question.region,
          question.difficulty,
          stored.type,
          JSON.stringify({ keys: stored.correctKeys }),
          question.source.url,
          question.source.quote_under_25_words.trim(),
          question.source.section_or_page,
          question.origin,
          question.official_number,
          question.needs_freshness_check,
        ],
      );
      await db.query(
        `insert into public.question_translations (question_id, locale, text, options, explanation)
         values ($1, $2, $3, $4, $5)
         on conflict (question_id, locale) do update set
           text = excluded.text, options = excluded.options, explanation = excluded.explanation`,
        [
          question.id,
          question.language,
          question.question,
          JSON.stringify(stored.options),
          question.explanation,
        ],
      );
      if (status) outcome.updated += 1;
      else outcome.added += 1;
    }
  });
  return outcome;
}
