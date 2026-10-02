import { readFile } from 'node:fs/promises';

import { convert } from 'html-to-text';
import { extractText as extractPdfText, getDocumentProxy } from 'unpdf';

export type MediaType = 'application/pdf' | 'text/html' | 'text/plain';

export interface LoadedSource {
  bytes: Uint8Array;
  mediaType: MediaType;
}

function detectMediaType(bytes: Uint8Array, hint: string): MediaType {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 512)).trimStart();
  if (head.startsWith('%PDF-')) return 'application/pdf';
  if (/^<!doctype html|^<html/i.test(head) || hint.includes('html')) return 'text/html';
  if (hint.includes('pdf')) return 'application/pdf';
  return 'text/plain';
}

/** Downloads a source document. Throws on any non-2xx response. */
export async function fetchSource(url: string): Promise<LoadedSource> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      // Some government sites refuse requests with no browser-like agent.
      'user-agent': 'Mozilla/5.0 (compatible; OathlyContentBot/1.0; study-guide ingestion)',
      accept: 'application/pdf,text/html;q=0.9,text/plain;q=0.8,*/*;q=0.5',
    },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: HTTP ${response.status} ${response.statusText}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, mediaType: detectMediaType(bytes, response.headers.get('content-type') ?? url) };
}

export async function readSourceFile(path: string): Promise<LoadedSource> {
  const bytes = new Uint8Array(await readFile(path));
  return { bytes, mediaType: detectMediaType(bytes, path.toLowerCase()) };
}

/**
 * The document's text with paragraphs separated by blank lines, ready for
 * splitIntoPassages(). PDF pages are separated the same way.
 */
export async function extractText(source: LoadedSource): Promise<string> {
  switch (source.mediaType) {
    case 'application/pdf': {
      // unpdf transfers the buffer it is given, so hand it a copy.
      const pdf = await getDocumentProxy(source.bytes.slice());
      const { text } = await extractPdfText(pdf, { mergePages: false });
      return text.join('\n\n');
    }
    case 'text/html':
      return convert(new TextDecoder().decode(source.bytes), {
        wordwrap: false,
        baseElements: { selectors: ['main', 'article', 'body'], orderBy: 'selectors' },
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' },
          { selector: 'nav', format: 'skip' },
          { selector: 'header', format: 'skip' },
          { selector: 'footer', format: 'skip' },
          { selector: 'script', format: 'skip' },
          { selector: 'style', format: 'skip' },
          { selector: 'form', format: 'skip' },
          { selector: 'h1', options: { uppercase: false } },
          { selector: 'h2', options: { uppercase: false } },
          { selector: 'h3', options: { uppercase: false } },
          { selector: 'h4', options: { uppercase: false } },
          { selector: 'table', format: 'dataTable', options: { uppercaseHeaderCells: false } },
        ],
      });
    case 'text/plain':
      return new TextDecoder().decode(source.bytes);
  }
}
