// Duplicate detection for question wording. Character trigrams rather than
// words, so it works the same for English, German, or a script without spaces.

export function fingerprint(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function trigrams(value: string): Map<string, number> {
  const padded = `  ${value} `;
  const grams = new Map<string, number>();
  for (let i = 0; i < padded.length - 2; i += 1) {
    const gram = padded.slice(i, i + 3);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

/** Dice coefficient over character trigrams: 0 (nothing shared) to 1 (same wording). */
export function similarity(a: string, b: string): number {
  const left = fingerprint(a);
  const right = fingerprint(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftGrams = trigrams(left);
  const rightGrams = trigrams(right);
  let shared = 0;
  let total = 0;
  for (const [gram, count] of leftGrams) {
    shared += Math.min(count, rightGrams.get(gram) ?? 0);
    total += count;
  }
  for (const count of rightGrams.values()) total += count;
  return (2 * shared) / total;
}

export interface ExistingQuestion {
  id: string;
  text: string;
}

export interface DuplicateMatch {
  id: string;
  score: number;
  /** Same wording once case and punctuation are ignored. */
  exact: boolean;
}

/** At or above this, two questions are worth a reviewer's look as possible duplicates. */
export const NEAR_DUPLICATE_THRESHOLD = 0.82;

/** The closest existing question, if it is close enough to matter. */
export function findDuplicate(
  text: string,
  existing: readonly ExistingQuestion[],
  threshold = NEAR_DUPLICATE_THRESHOLD,
): DuplicateMatch | null {
  const target = fingerprint(text);
  let best: DuplicateMatch | null = null;
  for (const question of existing) {
    const exact = fingerprint(question.text) === target;
    const score = exact ? 1 : similarity(text, question.text);
    if (score >= threshold && (!best || score > best.score)) {
      best = { id: question.id, score, exact };
    }
  }
  return best;
}
