import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { sourceManifestSchema, type SourceEntry } from './pack';
import { detectMediaType, extractText, type MediaType } from './source';
import { normalizeText, sha256 } from './text';

// Downloading official documents into data/sources/<ISO>/, and checking later
// whether the publisher has changed them. The copies stay on this machine:
// only their manifest is tracked, because most are not ours to redistribute.

type Fetch = typeof fetch;

const MAX_BYTES = 150 * 1024 * 1024;
const EXTENSIONS: Record<MediaType, string> = {
  'application/pdf': '.pdf',
  'text/html': '.html',
  'text/plain': '.txt',
};

export interface Download {
  bytes: Uint8Array;
  mediaType: MediaType;
  finalUrl: string;
  sha256: string;
  /** Of the document's text; null when no text could be taken from it. */
  textSha256: string | null;
}

/** Fetches a document and hashes it, both as bytes and as text. */
export async function download(url: string, fetchImpl: Fetch = fetch): Promise<Download> {
  const response = await fetchImpl(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000),
    headers: {
      // Some government sites refuse requests with no browser-like agent.
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      accept: 'application/pdf,text/html;q=0.9,*/*;q=0.5',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) throw new Error('The response was empty.');
  if (bytes.length > MAX_BYTES) throw new Error('The file is larger than 150 MB.');
  const mediaType = detectMediaType(bytes, response.headers.get('content-type') ?? url);
  let textSha256: string | null = null;
  try {
    const text = normalizeText(await extractText({ bytes, mediaType }));
    if (text) textSha256 = sha256(text);
  } catch {
    // A scanned or damaged document has no text to hash; the byte hash stands.
  }
  return { bytes, mediaType, finalUrl: response.url || url, sha256: sha256(bytes), textSha256 };
}

/** A safe file name for a download: from `name` if given, else from the address. */
export function sourceFileName(url: string, mediaType: MediaType, name?: string | null): string {
  const last =
    name ?? decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '');
  const cleaned = last
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120);
  const base = cleaned || new URL(url).hostname.replace(/[^A-Za-z0-9]+/g, '-');
  return /\.[A-Za-z0-9]{2,5}$/.test(base) ? base : `${base}${EXTENSIONS[mediaType]}`;
}

export interface SavedSourceFile {
  file: string;
  sha256: string;
  text_sha256: string | null;
  bytes: number;
  media_type: MediaType;
  final_url: string;
  retrieved_at: string;
}

/**
 * Downloads one document into data/sources/<ISO>/ and returns what
 * sources.json records about the copy. It does not touch sources.json.
 */
export async function saveSourceFile(
  dataDir: string,
  iso: string,
  url: string,
  options: { name?: string | null; fetchImpl?: Fetch; now?: Date } = {},
): Promise<SavedSourceFile> {
  if (!/^[A-Z]{2}$/.test(iso)) throw new Error('The country is two capital letters.');
  const got = await download(url, options.fetchImpl);
  const folder = path.join(dataDir, 'sources', iso);
  mkdirSync(folder, { recursive: true });
  const file = sourceFileName(url, got.mediaType, options.name);
  if (file === 'sources.json' || file === 'topic_map.md') {
    throw new Error(`"${file}" is the pack's own file: give the download another --name.`);
  }
  writeFileSync(path.join(folder, file), got.bytes);
  return {
    file,
    sha256: got.sha256,
    text_sha256: got.textSha256,
    bytes: got.bytes.length,
    media_type: got.mediaType,
    final_url: got.finalUrl,
    retrieved_at: (options.now ?? new Date()).toISOString(),
  };
}

export type SourceChange = 'same' | 'changed' | 'unreachable' | 'not_downloaded';

export interface SourceRecheck {
  iso: string;
  id: string;
  title: string;
  url: string;
  result: SourceChange;
  detail: string;
}

/**
 * Downloads every source in a pack again and compares it with what was
 * recorded. A web page whose bytes differ but whose text does not is the
 * same. A changed document is saved beside the old one as `<file>.new`, so
 * the two can be compared; the manifest is never rewritten here.
 */
export async function recheckSourceFiles(
  dataDir: string,
  iso: string,
  fetchImpl: Fetch = fetch,
): Promise<SourceRecheck[]> {
  const folder = path.join(dataDir, 'sources', iso);
  const manifest = sourceManifestSchema.parse(
    JSON.parse(readFileSync(path.join(folder, 'sources.json'), 'utf8')),
  );
  const checks: SourceRecheck[] = [];
  for (const source of manifest.sources) {
    checks.push({
      iso,
      id: source.id,
      title: source.title,
      url: source.url,
      ...(await compare(folder, source, fetchImpl)),
    });
  }
  return checks;
}

async function compare(
  folder: string,
  source: SourceEntry,
  fetchImpl: Fetch,
): Promise<Pick<SourceRecheck, 'result' | 'detail'>> {
  if (!source.file || !source.sha256) {
    return { result: 'not_downloaded', detail: 'No copy was kept; check it by hand.' };
  }
  let now: Download;
  try {
    now = await download(source.url, fetchImpl);
  } catch (error) {
    return {
      result: 'unreachable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  if (now.sha256 === source.sha256) return { result: 'same', detail: 'Identical.' };
  if (source.text_sha256 && now.textSha256 === source.text_sha256) {
    return { result: 'same', detail: 'The file differs but its text does not.' };
  }
  const copy = `${source.file}.new`;
  if (existsSync(folder)) writeFileSync(path.join(folder, copy), now.bytes);
  return { result: 'changed', detail: `The text has changed. New copy saved as ${copy}.` };
}
