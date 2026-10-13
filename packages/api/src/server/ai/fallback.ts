import {
  eagerGeneration,
  type GenerateRequest,
  type Generation,
  type TextGenerator,
} from './generator';

// More than one model behind the one generator the app asks. The first is
// asked; if it cannot start an answer (no credit, a rejected key, an outage)
// the next is asked the same thing, and the learner never sees the difference.

/** How long a model that could not answer is left alone before it is asked again. */
export const MODEL_REST_MS = 5 * 60 * 1000;

export interface FallbackOptions {
  /** Defaults to MODEL_REST_MS. */
  restMs?: number;
  now?: () => number;
  /** Told each time a model fails before writing anything. */
  onFailure?: (model: string, error: unknown) => void;
}

/** Thrown when there is no model to ask: no key is configured. */
export class NoModelError extends Error {
  constructor() {
    super('No AI model is configured.');
    this.name = 'NoModelError';
  }
}

/**
 * One generator that asks `generators` in order until one starts an answer.
 *
 * A model is only passed over if it failed before writing anything: an
 * answer that breaks off part-way is not started again by another model,
 * because the learner has already read the beginning. A model that declines
 * has answered.
 *
 * A model that failed rests for a few minutes, so that while it is down each
 * learner is not kept waiting on it first. Resting models are still asked
 * last, so a request is never refused while a model has not been tried.
 */
export function createFallbackGenerator(
  generators: readonly TextGenerator[],
  options: FallbackOptions = {},
): TextGenerator {
  const restMs = options.restMs ?? MODEL_REST_MS;
  const now = options.now ?? Date.now;
  const restingUntil = new Map<TextGenerator, number>();

  function order(): TextGenerator[] {
    const at = now();
    const resting = (generator: TextGenerator) => (restingUntil.get(generator) ?? 0) > at;
    return [
      ...generators.filter((generator) => !resting(generator)),
      ...generators.filter(resting),
    ];
  }

  return {
    model: generators[0]?.model ?? 'none',
    generate(request: GenerateRequest): Generation {
      return eagerGeneration(async (emit) => {
        let failure: unknown = new NoModelError();
        for (const generator of order()) {
          let wrote = false;
          try {
            const generation = generator.generate(request);
            // Read below; never left unhandled if the stream fails first.
            generation.result.catch(() => {});
            for await (const piece of generation.textStream) {
              wrote = true;
              emit(piece);
            }
            const result = await generation.result;
            restingUntil.delete(generator);
            return result;
          } catch (error) {
            if (wrote) throw error;
            restingUntil.set(generator, now() + restMs);
            options.onFailure?.(generator.model, error);
            failure = error;
          }
        }
        throw failure;
      });
    },
  };
}
