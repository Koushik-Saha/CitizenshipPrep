'use client';

/** A refused request: the server's message, and its code when it gave one. */
export class StreamError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'StreamError';
  }
}

/** Whether a request failed because AI help is paused or cannot be reached. */
export function isAiDown(error: unknown): boolean {
  return (
    error instanceof StreamError && (error.code === 'AI_PAUSED' || error.code === 'AI_UNAVAILABLE')
  );
}

/**
 * POSTs JSON and hands each piece of the plain-text reply to `onText` as it
 * arrives. Resolves with the response so the caller can read headers; throws
 * a StreamError with the server's message for an error status.
 */
export async function streamText(
  url: string,
  body: unknown,
  onText: (text: string) => void,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      error?: string;
      code?: string;
    } | null;
    throw new StreamError(
      error?.error ?? `Something went wrong (${response.status}).`,
      error?.code ?? null,
    );
  }
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onText(value);
  }
  return response;
}
