import { byteRange, getAudioClip } from '@oathly/api/server';

import { getDb } from '@/lib/db';

// GET /api/audio/<clip id>: one recorded clip for audio mode.
//
// No sign-in: an <audio> element cannot send a token, and a clip is only a
// published question read aloud. Its id is a hash of its words, so a clip
// never changes: browsers, phones and any CDN may keep it for good.
export async function GET(request: Request, { params }: RouteContext<'/api/audio/[id]'>) {
  const clip = await getAudioClip(getDb(), (await params).id);
  if (!clip) return new Response('Not found', { status: 404 });

  const headers = {
    'content-type': clip.contentType,
    'cache-control': 'public, max-age=31536000, immutable',
    'accept-ranges': 'bytes',
  };
  // Safari asks for audio in ranges and will not play without them.
  const range = byteRange(request.headers.get('range'), clip.data.byteLength);
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: { 'content-range': `bytes */${clip.data.byteLength}` },
    });
  }
  if (range) {
    return new Response(new Uint8Array(clip.data.subarray(range.start, range.end + 1)), {
      status: 206,
      headers: {
        ...headers,
        'content-range': `bytes ${range.start}-${range.end}/${clip.data.byteLength}`,
        'content-length': String(range.end - range.start + 1),
      },
    });
  }
  return new Response(new Uint8Array(clip.data), {
    headers: { ...headers, 'content-length': String(clip.data.byteLength) },
  });
}
