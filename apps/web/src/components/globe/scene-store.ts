// The link between pages and the one WebGL canvas in the root layout.
//
// A page that wants the globe renders a <GlobeSlot>, which registers its
// element here. The canvas (loaded later, on idle) moves itself into the
// current slot and draws that slot's scene. No three.js in this file, so
// pages can use it without pulling in the 3D bundle.

import type { GlobeView } from '@oathly/core/globe';

export type SceneName = 'hero' | 'picker' | 'celebration';

export interface GlobeMarker {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Lines shown under the name on hover. */
  facts: string[];
}

export interface Slot {
  id: string;
  element: HTMLElement;
  scene: SceneName;
  /** The view the slot's poster shows; the 3D globe starts here. */
  view: GlobeView;
  markers: GlobeMarker[];
  /** Country to turn to and highlight (picker, celebration). */
  focus: string | null;
  /** Called when someone clicks or taps a country on the 3D globe. */
  onSelect?: (code: string) => void;
}

export interface Hover {
  code: string;
  /** Position within the slot, in CSS pixels. */
  x: number;
  y: number;
}

interface State {
  slot: Slot | null;
  /** Whether the 3D globe is drawing the current slot (the poster can fade out). */
  live: boolean;
  hover: Hover | null;
}

let state: State = { slot: null, live: false, hover: null };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export const sceneStore = {
  getState: (): State => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Makes `slot` the one the canvas draws into. The newest slot wins: during
   * a page transition the incoming page's slot mounts before the old one
   * unmounts.
   */
  register(slot: Slot): () => void {
    set({ slot, live: false, hover: null });
    return () => {
      if (state.slot?.id === slot.id) set({ slot: null, live: false, hover: null });
    };
  },
  update(id: string, patch: Partial<Omit<Slot, 'id' | 'element'>>) {
    if (state.slot?.id === id) set({ slot: { ...state.slot, ...patch } });
  },
  setLive(live: boolean) {
    if (state.live !== live) set({ live });
  },
  setHover(hover: Hover | null) {
    if (state.hover?.code !== hover?.code || state.hover?.x !== hover?.x) set({ hover });
  },
};
