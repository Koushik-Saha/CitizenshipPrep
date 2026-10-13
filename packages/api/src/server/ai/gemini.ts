import {
  eagerGeneration,
  type GenerateRequest,
  type GenerationResult,
  type TextGenerator,
  type TokenUsage,
} from './generator';

// Google's Gemini, as a second model for when Claude cannot answer. It is
// sent the same instructions, the same passage and the same question.
//
// Called over plain HTTPS: the request is small and this keeps another SDK
// out of the server. https://ai.google.dev/api/generate-content

/** The lowest-cost current model, with the least thinking before it writes. */
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** The configured model if it is a plausible model name, else the default. */
export function geminiModel(configured: string | undefined): string {
  const name = configured?.trim() ?? '';
  return /^[a-z0-9][a-z0-9.-]{2,63}$/.test(name) ? name : GEMINI_MODEL;
}

function textOf(content: GenerateRequest['messages'][number]['content']): string {
  if (typeof content === 'string') return content;
  return content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n');
}

/** The request as Gemini takes it: instructions and material apart from the conversation. */
export function geminiBody(request: GenerateRequest) {
  return {
    systemInstruction: {
      parts: [request.system, request.context]
        .filter((text): text is string => Boolean(text))
        .map((text) => ({ text })),
    },
    contents: request.messages.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: textOf(message.content) }],
    })),
    generationConfig: { maxOutputTokens: request.maxTokens },
  };
}

/** The finish reasons that mean Gemini would not write the answer. */
const DECLINED = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION']);

interface GeminiEvent {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  modelVersion?: string;
}

/** What one event of the stream adds: words of the answer, and what is known so far. */
export function readGeminiEvent(event: GeminiEvent): {
  text: string;
  declined: boolean;
  usage: TokenUsage | null;
  model: string | null;
} {
  const candidate = event.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    // A model's notes to itself are not part of the answer.
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('');
  const counts = event.usageMetadata;
  const cached = counts?.cachedContentTokenCount ?? 0;
  return {
    text,
    declined:
      Boolean(event.promptFeedback?.blockReason) || DECLINED.has(candidate?.finishReason ?? ''),
    usage: counts
      ? {
          inputTokens: Math.max(0, (counts.promptTokenCount ?? 0) - cached),
          // Thinking is charged as output.
          outputTokens: (counts.candidatesTokenCount ?? 0) + (counts.thoughtsTokenCount ?? 0),
          cacheReadTokens: cached,
          cacheWriteTokens: 0,
        }
      : null,
    model: event.modelVersion ?? null,
  };
}

/** The JSON events of a server-sent event stream, one per `data:` line. */
export async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncIterable<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  for (;;) {
    const { done, value } = await reader.read();
    // A character may be split across two reads: the decoder holds its first half.
    buffered += done ? `${decoder.decode()}\n` : decoder.decode(value, { stream: true });
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data && data !== '[DONE]') yield JSON.parse(data);
    }
    if (done) return;
  }
}

export interface GeminiOptions {
  apiKey: string;
  /** Defaults to GEMINI_MODEL. */
  model?: string;
  fetch?: typeof fetch;
  /** How long the whole answer may take. */
  timeoutMs?: number;
}

export function createGeminiGenerator(options: GeminiOptions): TextGenerator {
  const model = options.model ?? GEMINI_MODEL;
  const send = options.fetch ?? fetch;
  return {
    model,
    generate(request) {
      return eagerGeneration(async (emit): Promise<GenerationResult> => {
        const response = await send(
          `${ENDPOINT}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
          {
            method: 'POST',
            // The key goes in a header, never in the address, so it cannot end up in a log.
            headers: { 'content-type': 'application/json', 'x-goog-api-key': options.apiKey },
            body: JSON.stringify(geminiBody(request)),
            signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
          },
        );
        if (!response.ok || !response.body) {
          const problem = (await response.json().catch(() => null)) as {
            error?: { status?: string };
          } | null;
          throw new Error(
            `Gemini answered ${response.status}${problem?.error?.status ? ` (${problem.error.status})` : ''}.`,
          );
        }

        let text = '';
        let declined = false;
        let usage: TokenUsage = {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        };
        let answeredBy = model;
        for await (const event of sseEvents(response.body)) {
          const read = readGeminiEvent(event as GeminiEvent);
          if (read.text) {
            text += read.text;
            emit(read.text);
          }
          declined ||= read.declined;
          usage = read.usage ?? usage;
          answeredBy = read.model ?? answeredBy;
        }
        const refused = declined && !text;
        // Nothing written and nothing declined is a failure, not an empty answer.
        if (!text && !refused) throw new Error('Gemini wrote nothing.');
        return { text, usage, model: answeredBy, refused };
      });
    },
  };
}
