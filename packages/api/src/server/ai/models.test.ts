import { describe, expect, it } from 'vitest';

import { createFallbackGenerator, NoModelError } from './fallback';
import {
  createGeminiGenerator,
  GEMINI_MODEL,
  geminiBody,
  geminiModel,
  readGeminiEvent,
} from './gemini';
import {
  eagerGeneration,
  started,
  type GenerateRequest,
  type Generation,
  type GenerationResult,
  type TextGenerator,
} from './generator';
import { configuredGenerators, isAiConfigured } from './models';

const usage = { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 };
const request: GenerateRequest = {
  system: 'Explain from the passage only.',
  context: '<source_passage>The council has nine members.</source_passage>',
  messages: [
    { role: 'user', content: 'How many members?' },
    { role: 'assistant', content: 'Nine.' },
    { role: 'user', content: 'Since when?' },
  ],
  maxTokens: 300,
};

/** A model that writes `chunks`, or fails once it has written `failAfter` of them. */
function model(name: string, chunks: string[], failAfter?: number) {
  const asked: GenerateRequest[] = [];
  const generator: TextGenerator = {
    model: name,
    generate(asking): Generation {
      asked.push(asking);
      const broken = failAfter !== undefined;
      const result: Promise<GenerationResult> = broken
        ? Promise.reject(new Error(`${name} is down`))
        : Promise.resolve({ text: chunks.join(''), usage, model: name, refused: false });
      result.catch(() => {});
      return {
        textStream: (async function* () {
          for (const [index, chunk] of chunks.entries()) {
            if (failAfter === index) throw new Error(`${name} is down`);
            yield chunk;
          }
          if (failAfter !== undefined && failAfter >= chunks.length) {
            throw new Error(`${name} is down`);
          }
        })(),
        result,
      };
    },
  };
  return { generator, asked };
}

async function readAll(generation: Generation): Promise<string> {
  let text = '';
  for await (const piece of generation.textStream) text += piece;
  return text;
}

describe('eagerGeneration', () => {
  it('writes the answer whether or not anyone reads the stream', async () => {
    const generation = eagerGeneration(async (emit) => {
      emit('Nine ');
      emit('members.');
      return { text: 'Nine members.', usage, model: 'm', refused: false };
    });
    expect((await generation.result).text).toBe('Nine members.');
    expect(await readAll(generation)).toBe('Nine members.');
  });

  it('gives what was written, then fails, when the writer fails', async () => {
    const generation = eagerGeneration(async (emit) => {
      emit('Nine ');
      throw new Error('cut off');
    });
    let text = '';
    await expect(
      (async () => {
        for await (const piece of generation.textStream) text += piece;
      })(),
    ).rejects.toThrow('cut off');
    expect(text).toBe('Nine ');
    await expect(generation.result).rejects.toThrow('cut off');
  });
});

describe('started', () => {
  it('waits for the first words and then gives the whole answer', async () => {
    const generation = await started(model('a', ['Nine ', 'members.']).generator.generate(request));
    expect(await readAll(generation)).toBe('Nine members.');
  });

  it('rejects when the model cannot begin', async () => {
    await expect(started(model('a', [], 0).generator.generate(request))).rejects.toThrow(
      'a is down',
    );
  });

  it('accepts an answer with no words, which is how a model declines', async () => {
    const generation = await started(model('a', []).generator.generate(request));
    expect(await readAll(generation)).toBe('');
  });
});

describe('createFallbackGenerator', () => {
  it('asks only the first model while it answers', async () => {
    const first = model('claude', ['From ', 'Claude.']);
    const second = model('gemini', ['From Gemini.']);
    const generation = createFallbackGenerator([first.generator, second.generator]).generate(
      request,
    );
    expect(await readAll(generation)).toBe('From Claude.');
    expect((await generation.result).model).toBe('claude');
    expect(second.asked).toHaveLength(0);
  });

  it('asks the next model the same thing when the first cannot begin, and says which failed', async () => {
    const first = model('claude', [], 0);
    const second = model('gemini', ['From ', 'Gemini.']);
    const failures: string[] = [];
    const generation = createFallbackGenerator([first.generator, second.generator], {
      onFailure: (name) => failures.push(name),
    }).generate(request);
    expect(await readAll(generation)).toBe('From Gemini.');
    // The usage record is filled in from this: it names the model that answered.
    expect((await generation.result).model).toBe('gemini');
    expect(second.asked).toEqual([request]);
    expect(failures).toEqual(['claude']);
  });

  it('answers a caller that waits on the result without reading the stream', async () => {
    const generation = createFallbackGenerator([
      model('claude', [], 0).generator,
      model('gemini', ['none']).generator,
    ]).generate(request);
    expect((await generation.result).text).toBe('none');
  });

  it('does not start an answer again once the learner has read its beginning', async () => {
    const first = model('claude', ['The council ', 'never'], 1);
    const second = model('gemini', ['From Gemini.']);
    const generation = createFallbackGenerator([first.generator, second.generator]).generate(
      request,
    );
    let text = '';
    await expect(
      (async () => {
        for await (const piece of generation.textStream) text += piece;
      })(),
    ).rejects.toThrow('claude is down');
    expect(text).toBe('The council ');
    expect(second.asked).toHaveLength(0);
  });

  it('leaves a model that failed alone for a while, then asks it again', async () => {
    let clock = 0;
    const first = model('claude', [], 0);
    const second = model('gemini', ['From Gemini.']);
    const generator = createFallbackGenerator([first.generator, second.generator], {
      restMs: 1000,
      now: () => clock,
    });
    await readAll(generator.generate(request));
    expect(first.asked).toHaveLength(1);

    clock = 500;
    await readAll(generator.generate(request));
    expect(first.asked).toHaveLength(1);
    expect(second.asked).toHaveLength(2);

    clock = 1500;
    await readAll(generator.generate(request));
    expect(first.asked).toHaveLength(2);
  });

  it('still asks a resting model when every other one fails', async () => {
    let failing = true;
    const flaky: TextGenerator = {
      model: 'claude',
      generate: (asking) =>
        model('claude', ['Back.'], failing ? 0 : undefined).generator.generate(asking),
    };
    const second = model('gemini', [], 0);
    const generator = createFallbackGenerator([flaky, second.generator], { now: () => 0 });
    await expect(generator.generate(request).result).rejects.toThrow();
    failing = false;
    expect((await generator.generate(request).result).text).toBe('Back.');
  });

  it('fails when every model fails, and when there is none', async () => {
    const generation = createFallbackGenerator([
      model('claude', [], 0).generator,
      model('gemini', [], 0).generator,
    ]).generate(request);
    await expect(readAll(generation)).rejects.toThrow('gemini is down');
    await expect(createFallbackGenerator([]).generate(request).result).rejects.toBeInstanceOf(
      NoModelError,
    );
  });
});

describe('Gemini', () => {
  const sse = (...events: unknown[]) =>
    new Response(events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join(''), {
      headers: { 'content-type': 'text/event-stream' },
    });

  it('sends the instructions and the passage apart from the conversation', () => {
    expect(geminiBody(request)).toEqual({
      systemInstruction: {
        parts: [{ text: request.system }, { text: request.context }],
      },
      contents: [
        { role: 'user', parts: [{ text: 'How many members?' }] },
        { role: 'model', parts: [{ text: 'Nine.' }] },
        { role: 'user', parts: [{ text: 'Since when?' }] },
      ],
      generationConfig: { maxOutputTokens: 300 },
    });
  });

  it('reads the words of an event, leaving out the model’s notes to itself', () => {
    expect(
      readGeminiEvent({
        candidates: [
          { content: { parts: [{ text: 'thinking…', thought: true }, { text: 'Nine.' }] } },
        ],
        usageMetadata: {
          promptTokenCount: 500,
          cachedContentTokenCount: 400,
          candidatesTokenCount: 20,
          thoughtsTokenCount: 5,
        },
        modelVersion: 'gemini-3.5-flash-lite',
      }),
    ).toEqual({
      text: 'Nine.',
      declined: false,
      usage: { inputTokens: 100, outputTokens: 25, cacheReadTokens: 400, cacheWriteTokens: 0 },
      model: 'gemini-3.5-flash-lite',
    });
  });

  it('streams an answer, with the key in a header and never in the address', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const generator = createGeminiGenerator({
      apiKey: 'secret-key',
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init! });
        return sse(
          { candidates: [{ content: { parts: [{ text: 'Nine ' }] } }] },
          {
            candidates: [{ content: { parts: [{ text: 'members.' }] }, finishReason: 'STOP' }],
            usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 6 },
            modelVersion: 'gemini-3.5-flash-lite',
          },
        );
      },
    });
    const generation = generator.generate(request);
    expect(await readAll(generation)).toBe('Nine members.');
    expect(await generation.result).toEqual({
      text: 'Nine members.',
      usage: { inputTokens: 120, outputTokens: 6, cacheReadTokens: 0, cacheWriteTokens: 0 },
      model: 'gemini-3.5-flash-lite',
      refused: false,
    });
    expect(calls[0]!.url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
    );
    expect(calls[0]!.url).not.toContain('secret-key');
    expect((calls[0]!.init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret-key');
  });

  it('fails when Google refuses the request, without repeating the key', async () => {
    const generator = createGeminiGenerator({
      apiKey: 'secret-key',
      fetch: async () =>
        Response.json(
          { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded.' } },
          { status: 429 },
        ),
    });
    const failure = await generator.generate(request).result.catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('Gemini answered 429 (RESOURCE_EXHAUSTED).');
  });

  it('reports a blocked answer as declined, and an empty one as a failure', async () => {
    const blocked = createGeminiGenerator({
      apiKey: 'k',
      fetch: async () => sse({ promptFeedback: { blockReason: 'SAFETY' } }),
    });
    expect(await blocked.generate(request).result).toMatchObject({ text: '', refused: true });

    const empty = createGeminiGenerator({
      apiKey: 'k',
      fetch: async () => sse({ candidates: [{ finishReason: 'MAX_TOKENS' }] }),
    });
    await expect(empty.generate(request).result).rejects.toThrow('Gemini wrote nothing.');
  });

  it('keeps to the default model unless the configured name looks like one', () => {
    expect(geminiModel(undefined)).toBe(GEMINI_MODEL);
    expect(geminiModel(' gemini-3.8-flash ')).toBe('gemini-3.8-flash');
    expect(geminiModel('../v1/files?x=')).toBe(GEMINI_MODEL);
  });
});

describe('configuredGenerators', () => {
  it('asks Claude first and Gemini after it, each only with a key', () => {
    expect(configuredGenerators({})).toEqual([]);
    expect(isAiConfigured({ ANTHROPIC_API_KEY: ' ' })).toBe(false);
    expect(configuredGenerators({ GEMINI_API_KEY: 'g' }).map((g) => g.model)).toEqual([
      GEMINI_MODEL,
    ]);
    expect(
      configuredGenerators({
        ANTHROPIC_API_KEY: 'a',
        GEMINI_API_KEY: 'g',
        GEMINI_MODEL: 'gemini-3.8-flash',
      }).map((g) => g.model),
    ).toEqual(['claude-haiku-4-5', 'gemini-3.8-flash']);
    expect(isAiConfigured({ GEMINI_API_KEY: 'g' })).toBe(true);
  });
});
