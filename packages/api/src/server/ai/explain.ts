import type { Quota } from '@oathly/core';
import { languageName } from '@oathly/i18n';
import type pg from 'pg';

import { toReadableStream, type TextGenerator } from './generator';
import { completeUsage, reserveUsage, type UsageOptions } from './usage';

// "Explain more": a deeper explanation of a question, in the learner's study
// language, grounded only in the passage of the official guide the question
// cites. Generated once per question version and language, then served from
// the cache.

type Db = Pick<pg.Pool, 'query'>;

export interface ExplanationContext {
  questionId: string;
  version: number;
  countryCode: string;
  countryName: string;
  /** The language to explain in. */
  locale: string;
  questionLocale: string;
  question: string;
  options: { key: string; text: string }[];
  correctKeys: string[];
  /** What the learner is grounded in: the stored passage, or failing that the cited words. */
  source: { title: string | null; text: string };
}

export async function explanationContext(
  db: Db,
  userId: string,
  questionId: string,
): Promise<ExplanationContext | null> {
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) return null;
  const { rows } = await db.query<{
    id: string;
    version: number;
    country_code: string;
    country_name: string;
    correct_answer: { keys: string[] };
    source_quote: string | null;
    passage_text: string | null;
    passage_heading: string | null;
    document_title: string | null;
    locale: string;
    text: string;
    options: { key: string; text: string }[];
    study_locale: string | null;
  }>(
    `select q.id, q.version, q.country_code, c.name as country_name, q.correct_answer,
            q.source_quote, p.text as passage_text, p.heading as passage_heading,
            d.title as document_title, w.locale, w.text, w.options, uc.study_locale
     from public.questions q
     join public.countries c on c.iso_code = q.country_code
     join public.question_translations w
       on w.question_id = q.id and w.translated_from is null and w.status = 'approved'
     left join public.source_passages p on p.id = q.source_passage_id
     left join public.source_documents d on d.id = p.document_id
     left join public.user_countries uc on uc.user_id = $2 and uc.country_code = q.country_code
     where q.id = $1 and q.status = 'published'`,
    [questionId, userId],
  );
  const row = rows[0];
  if (!row) return null;
  const sourceText = row.passage_text ?? row.source_quote;
  if (!sourceText) return null;
  return {
    questionId: row.id,
    version: row.version,
    countryCode: row.country_code,
    countryName: row.country_name,
    locale: row.study_locale ?? row.locale,
    questionLocale: row.locale,
    question: row.text,
    options: row.options,
    correctKeys: row.correct_answer.keys,
    source: {
      title: [row.document_title, row.passage_heading].filter(Boolean).join(', ') || null,
      text: sourceText,
    },
  };
}

export const EXPLAIN_SYSTEM = `You explain practice questions for Oathly, an independent app for people studying for a citizenship test. The learner has just answered a question wrongly and asked for a fuller explanation.

Explain why the correct answer is right, using only the source passage you are given. Where the passage also shows why a wrong option is wrong, say so briefly. If the passage does not support a point, leave the point out: never add facts from your own knowledge, even ones you are sure of, because the learner must be able to rely on the official guide alone.

You are not told which option the learner chose, and the same explanation is shown to everyone who gets the question wrong, so do not guess or mention what they answered.

Write for someone reading in a second language: plain words, short sentences, about 80 to 150 words. Write plain text in paragraphs: no Markdown, no asterisks or bold, no headings or lists. You may quote a few words of the passage; keep a quote in its original language and give its meaning in the explanation's language. Write the whole explanation in the language you are asked to use. Do not describe Oathly or this explanation as official.

The learner is waiting for the first words, so begin the explanation straight away.`;

export function explanationRequest(context: ExplanationContext) {
  const language = languageName(context.locale, 'en');
  const options = context.options.map((option) => `${option.key}) ${option.text}`).join('\n');
  const correct = context.options
    .filter((option) => context.correctKeys.includes(option.key))
    .map((option) => `${option.key}) ${option.text}`)
    .join('; ');
  return {
    system: EXPLAIN_SYSTEM,
    // The passage is material to explain from, not instructions to follow.
    context: `<source_passage${context.source.title ? ` title="${context.source.title.replace(/"/g, "'")}"` : ''}>
${context.source.text}
</source_passage>`,
    messages: [
      {
        role: 'user' as const,
        content: `Country: ${context.countryName}
Explain in: ${language} (${context.locale})

<question lang="${context.questionLocale}">${context.question}</question>
<options>
${options}
</options>
<correct_answer>${correct}</correct_answer>`,
      },
    ],
    maxTokens: 2000,
  };
}

export async function cachedExplanation(
  db: Db,
  context: ExplanationContext,
): Promise<string | null> {
  const { rows } = await db.query<{ text: string }>(
    `select text from public.ai_explanations
     where question_id = $1 and question_version = $2 and locale = $3`,
    [context.questionId, context.version, context.locale],
  );
  return rows[0]?.text ?? null;
}

export type ExplainOutcome =
  | { kind: 'cached'; text: string; locale: string }
  | { kind: 'stream'; stream: ReadableStream<Uint8Array>; locale: string }
  | { kind: 'limited'; quota: Quota }
  /** The whole service has used its day's AI: see reserveUsage. */
  | { kind: 'paused' }
  | { kind: 'unavailable' };

export async function explain(
  db: Db,
  generator: TextGenerator,
  userId: string,
  questionId: string,
  now: Date = new Date(),
  options: UsageOptions = {},
): Promise<ExplainOutcome> {
  const context = await explanationContext(db, userId, questionId);
  if (!context) return { kind: 'unavailable' };

  // An explanation already written costs nothing and is not counted.
  const cached = await cachedExplanation(db, context);
  if (cached) return { kind: 'cached', text: cached, locale: context.locale };

  // Counted now, before the model is asked: see reserveUsage.
  const reserved = await reserveUsage(
    db,
    {
      userId,
      feature: 'explanation',
      countryCode: context.countryCode,
      questionId: context.questionId,
      model: generator.model,
    },
    now,
    options,
  );
  if (reserved.kind !== 'reserved') return reserved;

  const generation = generator.generate(explanationRequest(context));
  const stream = toReadableStream(generation, async (result) => {
    await completeUsage(db, reserved.id, result);
    if (!result.refused && result.text.trim()) {
      await db.query(
        `insert into public.ai_explanations (question_id, question_version, locale, text, model)
         values ($1, $2, $3, $4, $5)
         on conflict do nothing`,
        [context.questionId, context.version, context.locale, result.text.trim(), result.model],
      );
    }
  });
  return { kind: 'stream', stream, locale: context.locale };
}
