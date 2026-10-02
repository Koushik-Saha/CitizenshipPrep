import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

import {
  draftResponseSchema,
  translationSchema,
  type DraftQuestion,
  type QuestionOption,
  type TranslationDraft,
} from './schemas';

export const DEFAULT_MODEL = 'claude-opus-5-5';

export interface DraftRequest {
  countryName: string;
  /** BCP 47 tag of the exam language; questions are written in it. */
  locale: string;
  documentTitle: string;
  passageHeading: string | null;
  passageText: string;
  existingTopics: { slug: string; name: string }[];
  /** Wording of questions that already exist, so they are not drafted again. */
  existingQuestions: string[];
  maxQuestions: number;
}

export interface TranslateRequest {
  sourceLocale: string;
  targetLocale: string;
  countryName: string;
  text: string;
  options: QuestionOption[];
  explanation: string | null;
}

/** The two things the pipeline asks a model to do. Tests supply a fake. */
export interface ContentModel {
  /** Recorded on every draft as `drafted_by_model`. */
  readonly name: string;
  draftQuestions(request: DraftRequest): Promise<DraftQuestion[]>;
  translate(request: TranslateRequest): Promise<TranslationDraft>;
}

export class ContentModelError extends Error {
  override readonly name = 'ContentModelError';
}

const DRAFT_SYSTEM = `You draft practice questions for Oathly, an independent study app for people preparing for a citizenship exam. A human reviewer checks every draft against the source before any learner sees it. Your job is to hand that reviewer accurate, well-cited drafts they can approve quickly.

You are given one passage from an official study guide. Write multiple-choice questions that test facts stated in that passage.

Sourcing
- Use only what the passage states. If you know a fact that the passage does not state, do not ask about it.
- source_quote is the sentence or sentences from the passage that establish the correct answer, copied character for character, at most 300 characters. The reviewer reads it next to your question, and software checks that it really appears in the passage: a paraphrased, shortened or stitched-together quote causes the draft to be thrown away.
- Prefer lasting facts. Skip details that go out of date, such as who currently holds an office, fees, addresses and phone numbers.

The question
- Four options with keys a to d, exactly one of them correct. Spread the correct answers across the keys.
- Wrong options should be plausible to someone who has not studied and clearly wrong according to the passage. Do not use "all of the above" or "none of the above".
- Ask one thing per question, in plain words. Many learners are studying in a second language.
- Do not describe the question as official or as taken from the real exam.
- Write the question, the options and the explanation in the exam language given in the request.

The explanation
- Two or three short sentences in plain language saying why the answer is correct, using only what the passage says.

Topic and difficulty
- Pick the topic from existing_topics when one fits. Propose a new one only when none does, with a slug in lowercase-with-hyphens and a short name. Topics are broad: a whole guide has perhaps four to eight.
- difficulty is a whole number from 1 (most adults already know it) to 5 (a detail that needs careful study).

How many
- Write up to max_questions, each about a different fact. Fewer is fine. Return an empty list when the passage has nothing worth testing, for example a table of contents, a form, or contact details.
- Do not repeat anything in existing_questions, even reworded.`;

const TRANSLATE_SYSTEM = `You translate practice questions for Oathly, an independent study app for people preparing for a citizenship exam. Learners read your translation to study in the language they think in, and a human reviewer checks it against the original before it is published.

- Translate the question, every option and the explanation. Keep each option's key exactly as given, and keep the options in the same order.
- Say exactly what the original says: add nothing, drop nothing, and do not correct it even if you think it is wrong.
- Use plain, natural wording that an adult with a basic education reads easily, in the standard written form of the target language.
- Keep the official names of institutions, documents and places recognisable. Where the target language has an established name use it, and where it helps the learner connect it to the exam, follow it with the original name in parentheses.
- Write numbers and dates in the target language's usual form.`;

function draftPrompt(request: DraftRequest): string {
  const topics =
    request.existingTopics.map((topic) => `- ${topic.slug}: ${topic.name}`).join('\n') ||
    '(none yet)';
  const existing = request.existingQuestions.map((text) => `- ${text}`).join('\n') || '(none yet)';
  return `<country>${request.countryName}</country>
<exam_language>${request.locale}</exam_language>
<max_questions>${request.maxQuestions}</max_questions>

<existing_topics>
${topics}
</existing_topics>

<existing_questions>
${existing}
</existing_questions>

<document>${request.documentTitle}</document>
<passage${request.passageHeading ? ` heading="${request.passageHeading.replace(/"/g, "'")}"` : ''}>
${request.passageText}
</passage>`;
}

function translatePrompt(request: TranslateRequest): string {
  const options = request.options.map((option) => `${option.key}: ${option.text}`).join('\n');
  return `<country>${request.countryName}</country>
<source_language>${request.sourceLocale}</source_language>
<target_language>${request.targetLocale}</target_language>

<question>${request.text}</question>
<options>
${options}
</options>
<explanation>${request.explanation ?? ''}</explanation>`;
}

function describeApiError(error: unknown): Error {
  if (error instanceof Anthropic.AuthenticationError) {
    return new ContentModelError('The Claude API rejected the key. Check ANTHROPIC_API_KEY.');
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new ContentModelError(`The Claude API key may not use this model: ${error.message}`);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ContentModelError('The Claude API is rate limiting this key. Try again shortly.');
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ContentModelError(`Could not reach the Claude API: ${error.message}`);
  }
  if (error instanceof Anthropic.APIError) {
    return new ContentModelError(`Claude API error ${error.status ?? ''}: ${error.message}`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

export interface ClaudeModelOptions {
  /** Defaults to a client that reads ANTHROPIC_API_KEY from the environment. */
  client?: Anthropic;
  model?: string;
}

export function createClaudeModel(options: ClaudeModelOptions = {}): ContentModel {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? DEFAULT_MODEL;

  async function ask<Schema extends z.ZodType>(
    system: string,
    prompt: string,
    schema: Schema,
  ): Promise<z.infer<Schema>> {
    let message;
    try {
      message = await client.beta.messages.parse({
        model,
        max_tokens: 16000,
        // If a safety classifier declines the request, the API retries it on
        // the model Anthropic recommends instead of returning the refusal.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: zodOutputFormat(schema) },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (error) {
      throw describeApiError(error);
    }
    if (message.stop_reason === 'refusal') {
      throw new ContentModelError('Claude declined this request.');
    }
    if (message.stop_reason === 'max_tokens') {
      throw new ContentModelError('Claude ran out of output space before finishing.');
    }
    if (message.parsed_output == null) {
      throw new ContentModelError('Claude returned output that does not match the expected shape.');
    }
    return message.parsed_output as z.infer<Schema>;
  }

  return {
    name: model,
    async draftQuestions(request) {
      const output = await ask(DRAFT_SYSTEM, draftPrompt(request), draftResponseSchema);
      return output.questions;
    },
    translate(request) {
      return ask(TRANSLATE_SYSTEM, translatePrompt(request), translationSchema);
    },
  };
}
