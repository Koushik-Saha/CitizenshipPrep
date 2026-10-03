// Shared by the globe asset script, the static poster and the WebGL scene,
// so the poster and the first 3D frame match. No three.js imports here.

import type { GlobeView } from '@oathly/core/globe';

/** Brand navy and gold (see @oathly/tokens). */
export const GLOBE_COLORS = {
  ocean: '#132244', // navy-900
  land: '#6B89C4', // navy-400
  halo: '#6B89C4',
  marker: '#E8B130', // gold-400
  markerHot: '#F5DC8F', // gold-200
} as const;

/** The view the landing page opens on: the Atlantic, with North America and Europe in sight. */
export const HERO_VIEW: GlobeView = { latitude: 24, longitude: -38 };

/** Poster widths in pixels; the globe fills the middle, leaving room for its atmosphere. */
export const POSTER_SIZES = [560, 720, 1080] as const;

/**
 * Phones get the 560px poster whatever their pixel density: it is on screen
 * for a moment before the 3D globe takes over, and it is the page's largest
 * image, so its size decides how soon the page looks ready.
 */
export const PHONE_POSTER = { media: '(max-width: 639px)', size: 560 } as const;

/** The globe's radius as a fraction of half the poster (or slot) width. */
export const POSTER_RADIUS = 0.8;

/** Degrees of longitude per second while idling. One turn takes six minutes. */
export const IDLE_SPIN = 1;
