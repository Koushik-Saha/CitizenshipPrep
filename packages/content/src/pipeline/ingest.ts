import type pg from 'pg';

import { withTransaction } from '../db';
import {
  findDocumentByUrl,
  getCountry,
  insertDocument,
  insertPassages,
  listCurrentPassages,
  recordDocumentCheck,
  setPassageOrdinals,
  supersedePassages,
  type SourceDocument,
} from '../repository';
import { extractText, type LoadedSource } from '../source';
import { hashText, sha256, splitIntoPassages } from '../text';

export interface IngestInput {
  countryCode: string;
  title: string;
  publisher: string | null;
  /** Where the document is published. For an uploaded file, the page it came from. */
  sourceUrl: string;
  locale: string;
  license: string;
  /** False when the bytes came from a local file: the monthly check cannot fetch it again. */
  isRefetchable: boolean;
  source: LoadedSource;
}

export interface SourceUpdate {
  documentId: string;
  /** `new` on first ingest; otherwise whether the text differs from what was stored. */
  outcome: 'new' | 'unchanged' | 'changed';
  passagesAdded: number;
  passagesRemoved: number;
  /** Questions citing a passage that is no longer in the source. */
  questionsFlagged: number;
}

/**
 * Brings the stored copy of a document in line with freshly fetched bytes.
 * Passages are matched by the hash of their text: ones that vanished are kept
 * but marked not current, and the questions citing them are flagged.
 */
export async function applySourceVersion(
  pool: pg.Pool,
  document: SourceDocument,
  source: LoadedSource,
): Promise<SourceUpdate> {
  const text = await extractText(source);
  const contentHash = hashText(text);
  const unchanged: SourceUpdate = {
    documentId: document.id,
    outcome: 'unchanged',
    passagesAdded: 0,
    passagesRemoved: 0,
    questionsFlagged: 0,
  };

  if (contentHash === document.contentHash) {
    await recordDocumentCheck(pool, document.id, null);
    return unchanged;
  }

  const fresh = splitIntoPassages(text);
  if (fresh.length === 0) {
    throw new Error(`No text could be extracted from the new version of "${document.title}".`);
  }

  return withTransaction(pool, async (db) => {
    const stored = await listCurrentPassages(db, document.id);
    const storedByHash = new Map(stored.map((passage) => [passage.contentHash, passage]));
    const freshHashes = new Set(fresh.map((passage) => passage.contentHash));

    const removed = stored.filter((passage) => !freshHashes.has(passage.contentHash));
    const added = fresh.filter((passage) => !storedByHash.has(passage.contentHash));
    const moved = fresh.flatMap((passage) => {
      const existing = storedByHash.get(passage.contentHash);
      return existing && existing.ordinal !== passage.ordinal
        ? [{ id: existing.id, ordinal: passage.ordinal }]
        : [];
    });

    const questionsFlagged = await supersedePassages(
      db,
      removed.map((passage) => passage.id),
    );
    await setPassageOrdinals(db, moved);
    await insertPassages(db, document.id, added);
    await recordDocumentCheck(db, document.id, {
      rawHash: sha256(source.bytes),
      contentHash,
      byteSize: source.bytes.byteLength,
    });

    return {
      documentId: document.id,
      outcome: 'changed',
      passagesAdded: added.length,
      passagesRemoved: removed.length,
      questionsFlagged,
    };
  });
}

/** Step 1 of the pipeline: store an official guide and split it into citable passages. */
export async function ingestSource(pool: pg.Pool, input: IngestInput): Promise<SourceUpdate> {
  const country = await getCountry(pool, input.countryCode);
  if (!country) {
    throw new Error(`Country ${input.countryCode} does not exist yet. Add it first.`);
  }

  const existing = await findDocumentByUrl(pool, input.countryCode, input.sourceUrl);
  if (existing) return applySourceVersion(pool, existing, input.source);

  const text = await extractText(input.source);
  const passages = splitIntoPassages(text);
  if (passages.length === 0) {
    throw new Error(`No text could be extracted from "${input.title}".`);
  }

  return withTransaction(pool, async (db) => {
    const documentId = await insertDocument(db, {
      countryCode: input.countryCode,
      title: input.title,
      publisher: input.publisher,
      sourceUrl: input.sourceUrl,
      mediaType: input.source.mediaType,
      locale: input.locale,
      license: input.license,
      isRefetchable: input.isRefetchable,
      rawHash: sha256(input.source.bytes),
      contentHash: hashText(text),
      byteSize: input.source.bytes.byteLength,
    });
    await insertPassages(db, documentId, passages);
    return {
      documentId,
      outcome: 'new',
      passagesAdded: passages.length,
      passagesRemoved: 0,
      questionsFlagged: 0,
    };
  });
}
