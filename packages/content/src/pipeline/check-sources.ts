import type pg from 'pg';

import { listDocuments } from '../repository';
import { fetchSource, type LoadedSource } from '../source';
import { applySourceVersion, type SourceUpdate } from './ingest';

export interface SourceCheck {
  documentId: string;
  title: string;
  sourceUrl: string;
  /** Present when the document was fetched and compared. */
  update?: SourceUpdate;
  /** Present when it could not be fetched or read; nothing was changed. */
  error?: string;
}

export interface CheckSourcesOptions {
  countryCode?: string;
  /** Replaceable for tests. */
  fetch?: (url: string) => Promise<LoadedSource>;
}

/**
 * Re-fetches every source that came from a URL, re-hashes it, and flags the
 * questions whose cited passage is no longer there. Meant to run monthly.
 * One unreachable source does not stop the others.
 */
export async function checkSources(
  pool: pg.Pool,
  options: CheckSourcesOptions = {},
): Promise<SourceCheck[]> {
  const fetch = options.fetch ?? fetchSource;
  const documents = await listDocuments(pool, {
    countryCode: options.countryCode,
    refetchableOnly: true,
  });

  const results: SourceCheck[] = [];
  for (const document of documents) {
    const result: SourceCheck = {
      documentId: document.id,
      title: document.title,
      sourceUrl: document.sourceUrl,
    };
    try {
      const source = await fetch(document.sourceUrl);
      result.update = await applySourceVersion(pool, document, source);
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    results.push(result);
  }
  return results;
}
