// What the AI features cost, worked out from the tokens each request used,
// and how close use is to a limit. For the admin's usage page.

/** The tokens one request, or many added together, used with one model. */
export interface AiTokens {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * List prices in US dollars per million tokens, by the start of a model's
 * name. Writing to the prompt cache costs a quarter more than input, and
 * reading from it a tenth. A model that is not here is not priced: better no
 * figure than a wrong one.
 */
const PRICES: { model: string; input: number; output: number }[] = [
  { model: 'claude-haiku-4-5', input: 1, output: 5 },
  // The fallback model. Its cache reads are a tenth of input too; it has no cache writes.
  { model: 'gemini-3.5-flash-lite', input: 0.3, output: 2.5 },
];

/** What these tokens cost in US dollars at list price, or null for a model with no price here. */
export function aiCostUsd(tokens: AiTokens): number | null {
  const price = PRICES.find((candidate) => tokens.model.startsWith(candidate.model));
  if (!price) return null;
  const perToken = 1 / 1_000_000;
  return (
    tokens.input * price.input * perToken +
    tokens.output * price.output * perToken +
    tokens.cacheWrite * price.input * 1.25 * perToken +
    tokens.cacheRead * price.input * 0.1 * perToken
  );
}

/** The cost of several lots of tokens. `unpriced` is how many lots had a model with no price. */
export function totalAiCostUsd(lots: readonly AiTokens[]): { usd: number; unpriced: number } {
  let usd = 0;
  let unpriced = 0;
  for (const lot of lots) {
    const cost = aiCostUsd(lot);
    if (cost === null) unpriced += 1;
    else usd += cost;
  }
  return { usd, unpriced };
}

/** Where use stands against a limit: reached, near it (four fifths or more), or neither. */
export type CapStatus = 'ok' | 'near' | 'reached';

export function capStatus(used: number, limit: number): CapStatus {
  if (limit <= 0 || used >= limit) return 'reached';
  return used >= Math.ceil(limit * 0.8) ? 'near' : 'ok';
}
