'use client';

// Audio mode as a React hook, shared by the web and mobile session screens.
// The screen says where the session is (which question, answering or
// feedback); this reads the question out, listens for an answer if asked to,
// and after a practice answer reads the explanation and moves on.

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  canHearAnswer,
  feedbackItems,
  listenForAnswer,
  promptItems,
  speakAll,
  type AskedQuestion,
  type AudioPhrases,
  type AudioPlatform,
} from './audio';
import type { QuestionWording } from './study';

type Mode = 'read' | 'listen' | 'quiet';

/** A breath between the explanation and the next question. */
const PAUSE_MS = 700;

export interface AudioSessionInput {
  platform: AudioPlatform;
  /** Audio mode is on. */
  enabled: boolean;
  /** Listen for a spoken answer once the question has been read. */
  listen: boolean;
  /** Feedback is practice only: an exam does not say whether an answer was right. */
  phase: 'answering' | 'feedback' | 'results';
  /** Changes when the question does. */
  questionKey: string | number;
  wording: QuestionWording;
  question: AskedQuestion;
  /** The exam is asked and answered aloud: no choices are read out. */
  spokenExam: boolean;
  /** In feedback: whether the answer just given was right. */
  correct: boolean;
  phrases: AudioPhrases;
  /** A spoken answer was clearly this option. */
  onAnswer: (key: string) => void;
  /** The explanation has been read: time for the next question. */
  onExplained: () => void;
}

export interface AudioSession {
  status: 'idle' | 'speaking' | 'listening';
  /** What was heard, when it matched no option: the learner decides what to do with it. */
  heard: string | null;
  /** The microphone was refused. */
  micBlocked: boolean;
  /** Whether this question can be answered aloud on this device. */
  canListen: boolean;
  /** Reads the current question (or explanation) again. */
  replay: () => void;
  /** Listens for an answer now, without reading anything first. */
  listenNow: () => void;
  /** Stops reading or listening, until the next question or a replay. */
  stop: () => void;
  /** Forgets what was heard. */
  clearHeard: () => void;
}

export function useAudioSession(input: AudioSessionInput): AudioSession {
  const [status, setStatus] = useState<AudioSession['status']>('idle');
  const [heard, setHeard] = useState<string | null>(null);
  const [micBlocked, setMicBlocked] = useState(false);
  // A request to do the current step differently: read it again, only
  // listen, or be quiet. It applies to the step it was made in; the next
  // question starts afresh.
  const [request, setRequest] = useState<{ step: string; mode: Mode; count: number }>({
    step: '',
    mode: 'read',
    count: 0,
  });

  const latest = useRef(input);
  useEffect(() => {
    latest.current = input;
  });

  const { enabled, phase, questionKey, platform } = input;
  const locale = input.wording.locale;
  const stepKey = `${phase}:${questionKey}`;
  const mode = request.step === stepKey ? request.mode : 'read';
  const again = request.step === stepKey ? request.count : 0;

  useEffect(() => {
    if (!enabled || phase === 'results' || mode === 'quiet') return;
    const stop = new AbortController();
    const { signal } = stop;

    async function step() {
      const now = latest.current;
      setHeard(null);
      if (phase === 'feedback') {
        setStatus('speaking');
        const items = feedbackItems(now.wording, now.question, now.correct, now.phrases);
        if (!(await speakAll(platform, items, signal))) return;
        setStatus('idle');
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
        if (!signal.aborted) latest.current.onExplained();
        return;
      }

      if (mode === 'read') {
        setStatus('speaking');
        const items = promptItems(now.wording, now.question, now.spokenExam, now.phrases);
        if (!(await speakAll(platform, items, signal))) return;
      }
      const listening = mode === 'listen' || latest.current.listen;
      if (!listening || !canHearAnswer(platform, now.question)) {
        setStatus('idle');
        return;
      }
      setStatus('listening');
      const answer = await listenForAnswer(platform, {
        wording: now.wording,
        question: now.question,
        spokenExam: now.spokenExam,
        signal,
      });
      if (answer.kind === 'stopped') return;
      setStatus('idle');
      if (answer.kind === 'answer') latest.current.onAnswer(answer.key);
      else if (answer.kind === 'unmatched') setHeard(answer.heard);
      else if (answer.kind === 'blocked') setMicBlocked(true);
    }

    void step();
    return () => {
      stop.abort();
      setStatus('idle');
    };
    // The wording's language is here so that switching between the study and
    // exam language reads the question again in the new one.
  }, [enabled, phase, questionKey, locale, platform, mode, again]);

  const ask = useCallback(
    (next: Mode) => setRequest((last) => ({ step: stepKey, mode: next, count: last.count + 1 })),
    [stepKey],
  );
  const replay = useCallback(() => ask('read'), [ask]);
  const listenNow = useCallback(() => {
    setMicBlocked(false);
    ask('listen');
  }, [ask]);
  const stop = useCallback(() => ask('quiet'), [ask]);
  const clearHeard = useCallback(() => setHeard(null), []);

  return {
    status: enabled ? status : 'idle',
    heard: enabled ? heard : null,
    micBlocked,
    canListen: canHearAnswer(platform, input.question),
    replay,
    listenNow,
    stop,
    clearHeard,
  };
}
