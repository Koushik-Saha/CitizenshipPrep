import type pg from 'pg';

import type { ContentModel } from '../claude';
import { withTransaction } from '../db';
import { findDuplicate } from '../duplicates';
import {
  ensureTopic,
  getCountry,
  getDocument,
  insertDraftQuestion,
  listPassagesWithoutQuestions,
  listQuestionTexts,
  listTopics,
} from '../repository';
import { checkDraft } from '../schemas';

export interface DraftOptions {
  documentId: string;
  /** Stop once this many drafts have been saved. */
  limit: number;
  /** Most questions to ask for from one passage. */
  perPassage?: number;
  /** Passages shorter than this rarely hold a testable fact. */
  minPassageChars?: number;
  log?: (message: string) => void;
}

export interface DraftSummary {
  passagesRead: number;
  saved: number;
  /** Saved, but flagged for the reviewer as close to an existing question. */
  possibleDuplicates: number;
  /** Not saved: same wording as an existing question. */
  exactDuplicates: number;
  /** Not saved: failed a check, most often a quote that is not in the passage. */
  discarded: { question: string; problems: string[] }[];
}

/**
 * Steps 2 and 3 of the pipeline: ask the model for questions passage by
 * passage and save the ones that pass the checks as drafts. Passages that
 * already have questions are skipped, so the command can be re-run to continue.
 */
export async function draftQuestions(
  pool: pg.Pool,
  model: ContentModel,
  options: DraftOptions,
): Promise<DraftSummary> {
  const log = options.log ?? (() => {});
  const perPassage = options.perPassage ?? 3;
  const minPassageChars = options.minPassageChars ?? 200;

  const document = await getDocument(pool, options.documentId);
  if (!document) throw new Error(`No source document with id ${options.documentId}.`);
  const country = await getCountry(pool, document.countryCode);
  if (!country) throw new Error(`Country ${document.countryCode} does not exist.`);

  const passages = await listPassagesWithoutQuestions(pool, document.id);
  const known = await listQuestionTexts(pool, document.countryCode);
  const summary: DraftSummary = {
    passagesRead: 0,
    saved: 0,
    possibleDuplicates: 0,
    exactDuplicates: 0,
    discarded: [],
  };

  for (const passage of passages) {
    if (summary.saved >= options.limit) break;
    if (passage.text.length < minPassageChars) continue;

    const topics = await listTopics(pool, document.countryCode);
    const candidates = await model.draftQuestions({
      countryName: country.name,
      locale: document.locale,
      documentTitle: document.title,
      passageHeading: passage.heading,
      passageText: passage.text,
      existingTopics: topics.map(({ slug, name }) => ({ slug, name })),
      existingQuestions: known.map((question) => question.text),
      maxQuestions: Math.min(perPassage, options.limit - summary.saved),
    });
    summary.passagesRead += 1;

    let savedHere = 0;
    for (const candidate of candidates) {
      if (summary.saved >= options.limit) break;

      const checked = checkDraft(candidate, passage.text);
      if (!checked.ok) {
        summary.discarded.push({ question: candidate.text, problems: checked.problems });
        continue;
      }
      const duplicate = findDuplicate(checked.draft.text, known);
      if (duplicate?.exact) {
        summary.exactDuplicates += 1;
        continue;
      }

      const questionId = await withTransaction(pool, async (db) => {
        const topicId = await ensureTopic(db, document.countryCode, checked.draft.topic);
        return insertDraftQuestion(db, {
          countryCode: document.countryCode,
          topicId,
          passageId: passage.id,
          sourceUrl: document.sourceUrl,
          locale: document.locale,
          model: model.name,
          duplicateOf: duplicate?.id ?? null,
          draft: checked.draft,
        });
      });
      known.push({ id: questionId, text: checked.draft.text });
      summary.saved += 1;
      savedHere += 1;
      if (duplicate) summary.possibleDuplicates += 1;
    }
    log(
      `Passage ${passage.ordinal + 1}${passage.heading ? ` (${passage.heading})` : ''}: ` +
        `${savedHere} saved of ${candidates.length} drafted`,
    );
  }
  return summary;
}
