'use client';

/**
 * POSTs JSON and hands each piece of the plain-text reply to `onText` as it
 * arrives. Resolves with the response so the caller can read headers; throws
 * with the server's message for an error status.
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
    const error = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error ?? `Something went wrong (${response.status}).`);
  }
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onText(value);
  }
  return response;
}
