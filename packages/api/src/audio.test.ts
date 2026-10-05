import { describe, expect, it } from 'vitest';

import {
  canHearAnswer,
  feedbackItems,
  listenForAnswer,
  MicBlockedError,
  promptItems,
  speakAll,
  type AudioPlatform,
  type SpokenItem,
} from './audio';
import type { QuestionWording } from './study';

const wording: QuestionWording = {
  locale: 'en',
  text: 'What is the supreme law of the land?',
  options: [
    { key: 'a', text: 'the Constitution' },
    { key: 'b', text: 'the Bill of Rights' },
  ],
  explanation: null,
  audio: { question: 'q'.repeat(64), options: null, answer: 'a'.repeat(64), explanation: null },
};
const question = { type: 'multiple_choice', correctKeys: ['a'] } as const;
const phrases = { locale: 'es', correct: 'Correcto.', notQuite: 'No del todo.' };

function platform(heard?: string[] | Error): AudioPlatform & { said: SpokenItem[] } {
  const said: SpokenItem[] = [];
  return {
    said,
    speak: (item) => {
      said.push(item);
      return Promise.resolve();
    },
    listen:
      heard === undefined
        ? undefined
        : () => (heard instanceof Error ? Promise.reject(heard) : Promise.resolve(heard)),
  };
}
const live = () => new AbortController().signal;

describe('what is said', () => {
  it('reads the question and its numbered choices, with a clip where one exists', () => {
    expect(promptItems(wording, question, false, phrases)).toEqual([
      { clipId: 'q'.repeat(64), text: 'What is the supreme law of the land?', locale: 'en' },
      { clipId: null, text: '1. the Constitution\n2. the Bill of Rights', locale: 'en' },
    ]);
  });

  it('asks only the question in a spoken exam', () => {
    expect(promptItems(wording, question, true, phrases).map((item) => item.text)).toEqual([
      'What is the supreme law of the land?',
    ]);
  });

  it('gives the verdict in the app’s language, the missed answer, and the explanation if any', () => {
    expect(feedbackItems(wording, question, false, phrases)).toEqual([
      { clipId: null, text: 'No del todo.', locale: 'es' },
      { clipId: 'a'.repeat(64), text: 'the Constitution', locale: 'en' },
    ]);
    const explained = { ...wording, explanation: 'It sets up the government.' };
    expect(feedbackItems(explained, question, true, phrases).map((item) => item.text)).toEqual([
      'Correcto.',
      'It sets up the government.',
    ]);
  });
});

describe('speakAll', () => {
  it('says everything in order', async () => {
    const device = platform();
    expect(await speakAll(device, promptItems(wording, question, false, phrases), live())).toBe(
      true,
    );
    expect(device.said).toHaveLength(2);
  });

  it('stops when told to', async () => {
    const stop = new AbortController();
    const device = platform();
    device.speak = (item) => {
      device.said.push(item);
      stop.abort();
      return Promise.resolve();
    };
    expect(
      await speakAll(device, promptItems(wording, question, false, phrases), stop.signal),
    ).toBe(false);
    expect(device.said).toHaveLength(1);
    expect(await speakAll(device, [], stop.signal)).toBe(false);
  });
});

describe('listenForAnswer', () => {
  const ask = (device: AudioPlatform, spokenExam = false, signal = live()) =>
    listenForAnswer(device, { wording, question, spokenExam, signal });

  it('recognises the answer itself, and its number when the choices were read out', async () => {
    expect(await ask(platform(["it's the constitution"]))).toEqual({ kind: 'answer', key: 'a' });
    expect(await ask(platform(['number two']))).toEqual({ kind: 'answer', key: 'b' });
    // Nobody read out choices in an interview, so "two" is not an answer there.
    expect(await ask(platform(['two']), true)).toEqual({ kind: 'unmatched', heard: 'two' });
  });

  it('does not take a number as a place for a free-response question', async () => {
    const open = { type: 'free_response', correctKeys: ['a', 'b'] } as const;
    const heard = (words: string) =>
      listenForAnswer(platform([words]), {
        wording,
        question: open,
        spokenExam: false,
        signal: live(),
      });
    expect(await heard('one')).toEqual({ kind: 'unmatched', heard: 'one' });
    expect(await heard('the bill of rights')).toEqual({ kind: 'answer', key: 'b' });
  });

  it('reports what was heard when it matches nothing, and silence when nothing was', async () => {
    expect(await ask(platform(['', ' the president ']))).toEqual({
      kind: 'unmatched',
      heard: 'the president',
    });
    expect(await ask(platform([]))).toEqual({ kind: 'silence' });
  });

  it('copes with devices that cannot listen, refuse, fail, or are stopped', async () => {
    expect(await ask(platform())).toEqual({ kind: 'silence' });
    expect(await ask(platform(new MicBlockedError('no')))).toEqual({ kind: 'blocked' });
    expect(await ask(platform(new Error('network')))).toEqual({ kind: 'silence' });
    const stop = new AbortController();
    stop.abort();
    expect(await ask(platform(['the constitution']), false, stop.signal)).toEqual({
      kind: 'stopped',
    });
  });

  it('takes spoken answers only for questions with one answer, on devices that listen', async () => {
    const multi = { type: 'multi_select', correctKeys: ['a', 'b'] } as const;
    expect(canHearAnswer(platform(['x']), question)).toBe(true);
    expect(canHearAnswer(platform(), question)).toBe(false);
    expect(canHearAnswer(platform(['x']), multi)).toBe(false);
    expect(
      await listenForAnswer(platform(['the constitution']), {
        wording,
        question: multi,
        spokenExam: false,
        signal: live(),
      }),
    ).toEqual({ kind: 'silence' });
  });
});
