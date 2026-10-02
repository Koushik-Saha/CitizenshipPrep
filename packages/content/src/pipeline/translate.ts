import type pg from 'pg';

import type { ContentModel } from '../claude';
import { getCountry, insertTranslationDraft, listQuestionsMissingLocale } from '../repository';
import { checkTranslation } from '../schemas';

export interface TranslateOptions {
  countryCode: string;
  locales: string[];
  /** Also translate questions still waiting for review. Off by default: they may yet change. */
  includeUnpublished?: boolean;
  /** Most questions to translate per locale. */
  limit?: number;
  log?: (message: string) => void;
}

export interface TranslateSummary {
  saved: number;
  discarded: { questionId: string; locale: string; problems: string[] }[];
}

/**
 * Step 6 of the pipeline: draft translations for questions that have none in
 * the chosen locales. They are saved as drafts and need review like anything else.
 */
export async function translateQuestions(
  pool: pg.Pool,
  model: ContentModel,
  options: TranslateOptions,
): Promise<TranslateSummary> {
  const log = options.log ?? (() => {});
  const country = await getCountry(pool, options.countryCode);
  if (!country) throw new Error(`Country ${options.countryCode} does not exist.`);

  const summary: TranslateSummary = { saved: 0, discarded: [] };
  for (const locale of options.locales) {
    const questions = await listQuestionsMissingLocale(pool, {
      countryCode: options.countryCode,
      locale,
      includeUnpublished: options.includeUnpublished ?? false,
      limit: options.limit ?? 500,
    });
    for (const question of questions) {
      const translated = await model.translate({
        sourceLocale: question.sourceLocale,
        targetLocale: locale,
        countryName: country.name,
        text: question.text,
        options: question.options,
        explanation: question.explanation,
      });
      const checked = checkTranslation(translated, question.options);
      if (!checked.ok) {
        summary.discarded.push({ questionId: question.id, locale, problems: checked.problems });
        continue;
      }
      await insertTranslationDraft(pool, {
        questionId: question.id,
        locale,
        translatedFrom: question.sourceLocale,
        model: model.name,
        ...checked.translation,
      });
      summary.saved += 1;
    }
    log(`${locale}: ${questions.length} question(s) translated`);
  }
  return summary;
}
