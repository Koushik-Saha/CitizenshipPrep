import { describe, expect, it, vi } from 'vitest';

import { createGoogleSpeaker, createSpeaker, NoVoiceError, speechLanguage } from './tts';

describe('speechLanguage', () => {
  it('gives each study language a voice to ask for', () => {
    expect(speechLanguage('es')).toBe('es-ES');
    expect(speechLanguage('zh-Hans')).toBe('cmn-CN');
    expect(speechLanguage('tl')).toBe('fil-PH');
    expect(speechLanguage('pt-PT')).toBe('pt-BR');
  });

  it('uses the exam country’s accent where there is one', () => {
    expect(speechLanguage('en', 'GB')).toBe('en-GB');
    expect(speechLanguage('en', 'au')).toBe('en-AU');
    expect(speechLanguage('fr', 'CA')).toBe('fr-CA');
    // No Canadian English or German Spanish voice: the default.
    expect(speechLanguage('en', 'CA')).toBe('en-US');
    expect(speechLanguage('es', 'DE')).toBe('es-ES');
    expect(speechLanguage('hi', 'US')).toBe('hi-IN');
  });

  it('knows which languages it has no voice for', () => {
    expect(speechLanguage('so')).toBeNull();
    expect(speechLanguage('xx-YY')).toBeNull();
  });
});

describe('createGoogleSpeaker', () => {
  const answer = (status: number, body: unknown) =>
    vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(
        new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
      ),
    );

  it('asks for the text in the right voice and returns the recording', async () => {
    const fetch = answer(200, { audioContent: Buffer.from([1, 2, 3]).toString('base64') });
    const speaker = createGoogleSpeaker({ apiKey: 'secret', fetch });
    const recording = await speaker.speak({ text: 'Hello', locale: 'en', countryCode: 'GB' });
    expect([...recording.data]).toEqual([1, 2, 3]);
    expect(recording.contentType).toBe('audio/mpeg');
    expect(recording.voice).toBe('google:en-GB');

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://texttospeech.googleapis.com/v1/text:synthesize');
    // The key travels in a header, never in the URL, where it would be logged.
    expect(new Headers(init!.headers).get('x-goog-api-key')).toBe('secret');
    expect(JSON.parse(init!.body as string)).toEqual({
      input: { text: 'Hello' },
      voice: { languageCode: 'en-GB' },
      audioConfig: { audioEncoding: 'MP3' },
    });
  });

  it('says when there is no voice, without calling the service for a language it cannot name', async () => {
    const fetch = answer(200, {});
    const speaker = createGoogleSpeaker({ apiKey: 'secret', fetch });
    await expect(speaker.speak({ text: 'Hello', locale: 'so' })).rejects.toThrow(NoVoiceError);
    expect(fetch).not.toHaveBeenCalled();

    const refused = createGoogleSpeaker({
      apiKey: 'secret',
      fetch: answer(400, 'Requested language code "am-ET" has no matching voice.'),
    });
    await expect(refused.speak({ text: 'Hello', locale: 'am' })).rejects.toThrow(NoVoiceError);
  });

  it('reports other failures as failures', async () => {
    const down = createGoogleSpeaker({ apiKey: 'secret', fetch: answer(503, 'try later') });
    await expect(down.speak({ text: 'Hello', locale: 'en' })).rejects.toThrow(
      'Text-to-speech failed (503): try later',
    );
    const badKey = createGoogleSpeaker({
      apiKey: 'secret',
      fetch: answer(400, 'API key not valid'),
    });
    await expect(badKey.speak({ text: 'Hello', locale: 'en' })).rejects.not.toThrow(NoVoiceError);
    const empty = createGoogleSpeaker({ apiKey: 'secret', fetch: answer(200, {}) });
    await expect(empty.speak({ text: 'Hello', locale: 'en' })).rejects.toThrow('no audio');
  });
});

describe('createSpeaker', () => {
  it('picks the service the environment names', () => {
    expect(createSpeaker({ GOOGLE_TTS_API_KEY: 'k' }).name).toContain('Google');
    expect(createSpeaker({ TTS_PROVIDER: 'macos' }).name).toContain('macOS');
    expect(() => createSpeaker({ TTS_PROVIDER: 'google' })).toThrow('GOOGLE_TTS_API_KEY');
    expect(() => createSpeaker({ TTS_PROVIDER: 'robot' })).toThrow('Unknown TTS_PROVIDER');
    expect(() => createSpeaker({})).toThrow('No text-to-speech service is set up');
  });
});
