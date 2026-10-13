import Anthropic from '@anthropic-ai/sdk';

// The one place the server talks to Claude for learners. Tests swap in a fake
// generator; nothing else in the app knows which model or SDK is behind it.

// Haiku: learners are waiting on the first words, and it starts writing in
// about half a second (Opus 5.5 measured 1.1 to 1.6 s). The answers are short
// and grounded in material we supply, which it handles well. Question
// drafting in packages/content stays on Opus.
export const AI_MODEL = 'claude-haiku-4-5';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface GenerationResult {
  text: string;
  usage: TokenUsage;
  /** The model that produced the answer (a fallback model if the first one declined). */
  model: string;
  /** The model declined to answer. */
  refused: boolean;
}

export interface Generation {
  /** The answer as it is written. Iterate it once. */
  textStream: AsyncIterable<string>;
  /** Resolves when the answer is complete. */
  result: Promise<GenerationResult>;
}

export interface GenerateRequest {
  system: string;
  /** Per-request context (study material, the passage) kept apart from the stable instructions. */
  context?: string;
  messages: Anthropic.MessageParam[];
  maxTokens: number;
}

export interface TextGenerator {
  readonly model: string;
  generate(request: GenerateRequest): Generation;
}

export function createClaudeGenerator(client: Anthropic = new Anthropic()): TextGenerator {
  return {
    model: AI_MODEL,
    generate(request) {
      const system: Anthropic.TextBlockParam[] = [
        // Stable instructions first, cached; per-request context after.
        { type: 'text', text: request.system, cache_control: { type: 'ephemeral' } },
      ];
      if (request.context) system.push({ type: 'text', text: request.context });

      const stream = client.messages.stream({
        model: AI_MODEL,
        max_tokens: request.maxTokens,
        system,
        messages: request.messages,
      });

      async function* text(): AsyncIterable<string> {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield event.delta.text;
          }
        }
      }

      const result = stream.finalMessage().then((message) => ({
        text: message.content
          .flatMap((block) => (block.type === 'text' ? [block.text] : []))
          .join(''),
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
          cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
        },
        model: message.model,
        refused: message.stop_reason === 'refusal',
      }));
      // Callers may stop reading early; never leave this rejection unhandled.
      result.catch(() => {});

      return { textStream: text(), result };
    },
  };
}

/**
 * Starts `run` at once and gives back what it writes. `run` calls `emit` with
 * each piece of the answer and resolves with the finished result.
 *
 * The answer is written whether or not anyone reads `textStream`: a caller
 * may wait on `result` alone. If `run` fails, the stream fails after the
 * pieces already written.
 */
export function eagerGeneration(
  run: (emit: (text: string) => void) => Promise<GenerationResult>,
): Generation {
  const pieces: string[] = [];
  let ended = false;
  let wake: (() => void) | null = null;
  const stir = () => {
    wake?.();
    wake = null;
  };

  const result = run((text) => {
    pieces.push(text);
    stir();
  });
  const settled = result.then(
    () => null,
    (error: unknown) => ({ error }),
  );
  void settled.then(() => {
    ended = true;
    stir();
  });

  async function* text(): AsyncIterable<string> {
    for (;;) {
      if (pieces.length > 0) yield pieces.shift()!;
      else if (ended) break;
      else await new Promise<void>((resolve) => (wake = resolve));
    }
    const failure = await settled;
    if (failure) throw failure.error;
  }

  return { textStream: text(), result };
}

/**
 * Waits until the answer has begun: its first words, or its end if it has
 * none. Rejects if the model could not be reached at all. That is the moment
 * to tell the learner so, before anything has been sent to them.
 */
export async function started(generation: Generation): Promise<Generation> {
  const pieces = generation.textStream[Symbol.asyncIterator]();
  const first = await pieces.next();
  async function* text(): AsyncIterable<string> {
    try {
      if (first.done) return;
      yield first.value;
      for (;;) {
        const next = await pieces.next();
        if (next.done) return;
        yield next.value;
      }
    } finally {
      await pieces.return?.();
    }
  }
  return { textStream: text(), result: generation.result };
}

/** What ends an answer that broke off part-way: said of explanations and tutor replies alike. */
export const STOPPED_EARLY = 'The answer stopped early. Please try again.';

/**
 * Streams the generation as UTF-8, then calls `onComplete` with the result.
 * A failure mid-stream ends the response with a short note rather than
 * leaving the reader hanging.
 */
export function toReadableStream(
  generation: Generation,
  onComplete: (result: GenerationResult) => Promise<void>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of generation.textStream) controller.enqueue(encoder.encode(chunk));
        const result = await generation.result;
        if (result.refused && !result.text) {
          controller.enqueue(encoder.encode('Sorry, I can’t help with that.'));
        }
        await onComplete(result);
      } catch {
        controller.enqueue(encoder.encode(`\n\n(${STOPPED_EARLY})`));
      } finally {
        controller.close();
      }
    },
  });
}
