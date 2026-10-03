'use client';

import { chooseSceneMode, type DeviceSignals } from '@oathly/core/globe';
import dynamic from 'next/dynamic';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { sceneStore } from './scene-store';

// three.js and React Three Fiber live in this chunk. It is never rendered on
// the server and only requested once the browser is idle.
const GlobeCanvas = dynamic(() => import('./globe-canvas'), { ssr: false });

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function deviceSignals(): DeviceSignals {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return {
    prefersReducedMotion: matchMedia(REDUCED_MOTION).matches,
    saveData: nav.connection?.saveData,
    cores: nav.hardwareConcurrency || undefined,
    memoryGb: nav.deviceMemory,
    webgl2: typeof WebGL2RenderingContext !== 'undefined',
  };
}

/** How long the page must have been loaded before the 3D starts downloading. */
const SETTLE_MS = 4000;

/**
 * Calls `ready` once the page has loaded, had a moment to settle, the main
 * thread is idle, and `element` is on screen. Returns a cancel function.
 * The 3D bundle is the heaviest thing on the page, so it waits behind
 * everything a visitor might be doing in their first seconds.
 */
function whenSettled(element: HTMLElement, ready: () => void): () => void {
  let cancelled = false;
  const cleanups: (() => void)[] = [];
  const onScreen = () => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry!.isIntersecting || cancelled) return;
      observer.disconnect();
      ready();
    });
    observer.observe(element);
    cleanups.push(() => observer.disconnect());
  };
  const idle = () => {
    if ('requestIdleCallback' in window) {
      const handle = requestIdleCallback(onScreen, { timeout: 3000 });
      cleanups.push(() => cancelIdleCallback(handle));
    } else {
      onScreen();
    }
  };
  const afterLoad = () => {
    const handle = setTimeout(idle, SETTLE_MS);
    cleanups.push(() => clearTimeout(handle));
  };
  if (document.readyState === 'complete') afterLoad();
  else {
    window.addEventListener('load', afterLoad, { once: true });
    cleanups.push(() => window.removeEventListener('load', afterLoad));
  }
  return () => {
    cancelled = true;
    for (const cleanup of cleanups) cleanup();
  };
}

/**
 * Lives in the root layout and owns the app's one WebGL canvas. Pages ask for
 * the globe with <GlobeSlot>; until the canvas is ready (or on devices that
 * should not run it) they show the static poster.
 */
export function SceneHost() {
  const slotElement = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().slot?.element ?? null,
    () => null,
  );
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
  const [load, setLoad] = useState(false);

  // The first time a page wants the globe: decide whether this device should
  // draw it, and if so load it once the page has settled. Later pages reuse it.
  useEffect(() => {
    if (load || !slotElement || reducedMotion) return;
    if (chooseSceneMode(deviceSignals()) !== 'globe') return;
    return whenSettled(slotElement, () => setLoad(true));
  }, [load, slotElement, reducedMotion]);

  // Switching reduced motion on mid-visit removes the canvas and brings the poster back.
  useEffect(() => {
    if (reducedMotion) sceneStore.setLive(false);
  }, [reducedMotion]);

  return load && !reducedMotion ? <GlobeCanvas /> : null;
}
