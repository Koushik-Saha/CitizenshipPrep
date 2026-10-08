import NetInfo from '@react-native-community/netinfo';
import {
  addOfflineAttempt,
  ApiError,
  emptyOutbox,
  packClipIds,
  parseOutbox,
  recordResult,
  serializeOutbox,
  startOfflineSession,
  syncAll,
  waitingCount,
  type CountryPack,
  type Outbox,
  type PackAnswer,
  type SessionResult,
  type StartSessionRequest,
  type StudySession,
} from '@oathly/api';
import { countryPackSchema } from '@oathly/api/schemas';
import {
  createRandom,
  emptyQueue,
  enqueue,
  nextSyncAt,
  parseQueue,
  serializeQueue,
  type OfflineQueue,
  type QueuedAnswer,
} from '@oathly/core';
import { onlineManager } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { audioStore } from './audio-store';
import { api } from './auth';
import { files, kv } from './storage';

// Studying without a connection. Three things live on the phone:
//
//   packs    one downloaded file per country: questions, exam formats and the
//            learner's history, enough to build sessions with the quiz engine
//   audio    the recorded clips those questions use, so audio mode works too
//   queue    answers not yet confirmed by the server (the engine's offline queue)
//   outbox   sessions started here, and results of sessions finished offline
//
// Everything is written to storage as it changes, so closing the app loses
// nothing, and it is all sent when the phone is back online.

const KEYS = {
  queue: 'oathly.answer-queue.v1',
  outbox: 'oathly.outbox.v1',
  packs: 'oathly.packs.v1',
  localAnswers: 'oathly.local-answers.v1',
  packAudio: 'oathly.pack-audio.v1',
};
const packFile = (countryCode: string) => `pack-${countryCode}.json`;

export interface PackInfo {
  countryCode: string;
  countryName: string;
  /** When the server built the pack: how fresh the questions are. */
  generatedAt: string;
  questions: number;
  /** Recorded clips saved with it, for audio mode. */
  audioClips: number;
}

/** An answer given on this phone, kept so offline practice can adapt to it. */
interface LocalAnswer extends PackAnswer {
  clientEventId: string;
  countryCode: string;
}

export interface OfflineState {
  /** False until storage has been read at launch. */
  ready: boolean;
  online: boolean;
  syncing: boolean;
  /** Answers and results still to reach the server. */
  waiting: number;
  packs: Record<string, PackInfo>;
  /** The country whose pack is downloading, if any. */
  downloading: string | null;
  /** While a pack's audio is being saved: how far along it is. */
  audioProgress: { done: number; total: number } | null;
  /** Why the last sync stopped early, in the server's or the network's words. */
  syncProblem: string | null;
}

let state: OfflineState = {
  ready: false,
  online: true,
  syncing: false,
  waiting: 0,
  packs: {},
  downloading: null,
  audioProgress: null,
  syncProblem: null,
};
let queue: OfflineQueue = emptyQueue();
let outbox: Outbox = emptyOutbox();
let localAnswers: LocalAnswer[] = [];
/** Which saved clips each pack uses, so removing a pack removes only its own. */
let packAudio: Record<string, string[]> = {};
let timer: ReturnType<typeof setTimeout> | undefined;

const listeners = new Set<() => void>();
const syncedListeners = new Set<() => void>();

function set(patch: Partial<OfflineState>) {
  state = { ...state, ...patch, waiting: waitingCount(outbox, queue) };
  for (const listener of listeners) listener();
}

function persist() {
  void kv.set(KEYS.queue, serializeQueue(queue));
  void kv.set(KEYS.outbox, serializeOutbox(outbox));
  void kv.set(KEYS.localAnswers, JSON.stringify(localAnswers));
}

function schedule(delay: number) {
  clearTimeout(timer);
  timer = setTimeout(() => void sync(), delay);
}

/** Sends everything that is waiting. Safe to call at any time; never throws. */
export async function sync(): Promise<void> {
  if (state.syncing || !state.ready) return;
  if (waitingCount(outbox, queue) === 0 && outbox.attempts.length === 0) return;
  if (!state.online) return;
  set({ syncing: true });
  const before = waitingCount(outbox, queue);
  try {
    const result = await syncAll(api, outbox, queue, Date.now());
    outbox = result.outbox;
    queue = result.queue;
    persist();
    set({ syncing: false, syncProblem: result.stoppedBy });
  } catch (error) {
    set({ syncing: false, syncProblem: error instanceof Error ? error.message : String(error) });
  }
  if (waitingCount(outbox, queue) < before) for (const listener of syncedListeners) listener();
  const next = nextSyncAt(queue);
  if (next !== null) schedule(Math.max(1_000, next - Date.now()));
}

let started = false;

/** Reads what was stored and starts watching the connection. Call once at launch. */
export async function startOffline(): Promise<void> {
  if (started) return;
  started = true;
  const [storedQueue, storedOutbox, storedPacks, storedAnswers, storedAudio] = await Promise.all([
    kv.get(KEYS.queue),
    kv.get(KEYS.outbox),
    kv.get(KEYS.packs),
    kv.get(KEYS.localAnswers),
    kv.get(KEYS.packAudio),
  ]);
  queue = parseQueue(storedQueue);
  outbox = parseOutbox(storedOutbox);
  let packs: Record<string, PackInfo> = {};
  try {
    packs = storedPacks ? (JSON.parse(storedPacks) as Record<string, PackInfo>) : {};
    localAnswers = storedAnswers ? (JSON.parse(storedAnswers) as LocalAnswer[]) : [];
    packAudio = storedAudio ? (JSON.parse(storedAudio) as Record<string, string[]>) : {};
  } catch {
    packs = {};
    localAnswers = [];
    packAudio = {};
  }
  set({ ready: true, packs });

  NetInfo.addEventListener((net) => {
    // `isInternetReachable` is null while unknown: only a definite no counts.
    const online = net.isConnected !== false && net.isInternetReachable !== false;
    onlineManager.setOnline(online);
    if (online !== state.online) {
      set({ online });
      if (online) schedule(0);
    }
  });
  AppState.addEventListener('change', (status) => {
    if (status === 'active') schedule(0);
  });
  schedule(0);
}

/** How many clips to fetch at once. */
const AUDIO_DOWNLOADS = 6;

/**
 * Saves a pack's recorded clips. Returns the ids that are now on the phone;
 * one that fails is simply read by the phone's own voice when offline.
 */
async function saveAudio(clipIds: string[]): Promise<string[]> {
  const saved: string[] = [];
  let next = 0;
  let done = 0;
  set({ audioProgress: { done, total: clipIds.length } });
  await Promise.all(
    Array.from({ length: Math.min(AUDIO_DOWNLOADS, clipIds.length) }, async () => {
      while (next < clipIds.length) {
        const clipId = clipIds[next++]!;
        if (await audioStore.save(clipId, api.audioUrl(clipId))) saved.push(clipId);
        done += 1;
        if (done % 5 === 0 || done === clipIds.length) {
          set({ audioProgress: { done, total: clipIds.length } });
        }
      }
    }),
  );
  set({ audioProgress: null });
  return saved;
}

/** Deletes clips this pack used that no other pack does. */
async function dropAudio(countryCode: string, keep: readonly string[] = []): Promise<void> {
  const others = new Set(
    Object.entries(packAudio).flatMap(([code, ids]) => (code === countryCode ? [] : ids)),
  );
  const kept = new Set(keep);
  const unused = (packAudio[countryCode] ?? []).filter((id) => !others.has(id) && !kept.has(id));
  await audioStore.remove(unused);
}

/** Downloads (or refreshes) everything needed to study a country offline. */
export async function downloadPack(countryCode: string): Promise<void> {
  set({ downloading: countryCode });
  try {
    const pack = await api.countryPack(countryCode);
    await files.write(packFile(pack.countryCode), JSON.stringify(pack));
    // The questions are safe on the phone; now the recordings of them.
    const audio = await saveAudio(packClipIds(pack));
    await dropAudio(pack.countryCode, audio);
    packAudio = { ...packAudio, [pack.countryCode]: audio };
    await kv.set(KEYS.packAudio, JSON.stringify(packAudio));
    const packs = {
      ...state.packs,
      [pack.countryCode]: {
        countryCode: pack.countryCode,
        countryName: pack.countryName,
        generatedAt: pack.generatedAt,
        questions: pack.questions.length,
        audioClips: audio.length,
      },
    };
    await kv.set(KEYS.packs, JSON.stringify(packs));
    // The new pack's history has every answer the server knows. Keep only the
    // local ones it cannot know yet: those still waiting in the queue.
    const unsent = new Set(queue.pending.map((entry) => entry.answer.clientEventId));
    localAnswers = localAnswers.filter(
      (answer) => answer.countryCode !== pack.countryCode || unsent.has(answer.clientEventId),
    );
    persist();
    set({ packs });
  } finally {
    set({ downloading: null, audioProgress: null });
  }
}

export async function removePack(countryCode: string): Promise<void> {
  await files.remove(packFile(countryCode));
  await dropAudio(countryCode);
  const remaining = { ...packAudio };
  delete remaining[countryCode];
  packAudio = remaining;
  await kv.set(KEYS.packAudio, JSON.stringify(packAudio));
  const packs = { ...state.packs };
  delete packs[countryCode];
  await kv.set(KEYS.packs, JSON.stringify(packs));
  set({ packs });
}

/**
 * Removes everything the app has saved on this phone for the learner: saved
 * countries and their audio, answers still waiting to be sent, and answers
 * kept for offline study. For when the account is deleted.
 */
export async function forgetEverything(): Promise<void> {
  clearTimeout(timer);
  for (const countryCode of Object.keys(state.packs)) await removePack(countryCode);
  queue = emptyQueue();
  outbox = emptyOutbox();
  localAnswers = [];
  await Promise.all(Object.values(KEYS).map((key) => kv.remove(key)));
  set({ packs: {}, syncProblem: null });
}

async function readPack(countryCode: string): Promise<CountryPack | null> {
  if (!state.packs[countryCode]) return null;
  const stored = await files.read(packFile(countryCode));
  if (!stored) return null;
  try {
    return countryPackSchema.parse(JSON.parse(stored));
  } catch {
    return null;
  }
}

export class OfflineError extends Error {
  override readonly name = 'OfflineError';
}

/**
 * Starts a session: on the server when there is a connection, otherwise on
 * the phone from the country's downloaded pack.
 */
export async function startSession(
  request: StartSessionRequest,
): Promise<{ session: StudySession; offline: boolean }> {
  if (state.online) {
    try {
      const { attemptId } = await api.startSession(request);
      return { session: await api.session(attemptId), offline: false };
    } catch (error) {
      // The server said no (or the session has expired): that is the answer.
      if (error instanceof ApiError) throw error;
      // Otherwise the request never arrived: carry on without the server.
    }
  }
  const pack = await readPack(request.countryCode);
  if (!pack) {
    throw new OfflineError(
      'No connection. Download this country while you are online to study without one.',
    );
  }
  const { session, attempt } = startOfflineSession(pack, request, {
    attemptId: Crypto.randomUUID(),
    now: new Date(),
    random: createRandom(Math.floor(Math.random() * 2 ** 31)),
    localAnswers: localAnswers.filter((answer) => answer.countryCode === pack.countryCode),
  });
  outbox = addOfflineAttempt(outbox, attempt);
  persist();
  set({});
  return { session, offline: true };
}

/** Records an answer and returns at once. It is sent shortly after, in the background. */
export function recordAnswer(answer: QueuedAnswer, countryCode: string): void {
  queue = enqueue(queue, answer, Date.now());
  localAnswers = [
    ...localAnswers,
    {
      clientEventId: answer.clientEventId,
      countryCode,
      questionId: answer.questionId,
      correct: answer.correct,
      timeMs: answer.timeMs,
      answeredAt: answer.answeredAt,
    },
  ];
  persist();
  set({});
  // Batch answers given in quick succession into one request.
  schedule(1_500);
}

/** Records how a session ended; reported to the server now or when next online. */
export function completeSession(attemptId: string, result: SessionResult): void {
  outbox = recordResult(outbox, attemptId, result);
  persist();
  set({});
  schedule(0);
}

/** Called after a sync delivered something, e.g. to refresh the dashboard. */
export function onSynced(listener: () => void): () => void {
  syncedListeners.add(listener);
  return () => syncedListeners.delete(listener);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether the phone has a connection, as last seen. */
export function isOnline(): boolean {
  return state.online;
}

export function useOffline(): OfflineState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
