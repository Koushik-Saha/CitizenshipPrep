// Turning the globe by hand. Apart from globe.ts so that only the 3D scene,
// which loads after the page, carries it: the landing page's own JavaScript
// has a budget.

import type { GlobeView } from './globe';

const RAD = Math.PI / 180;

/** How far dragging may tilt the globe, in degrees of latitude either way: the poles stay out of the middle. */
export const MAX_DRAG_LATITUDE = 60;

/** Whether a point `x`, `y` from the globe's centre, in pixels, is on the globe. */
export function isOnGlobe(x: number, y: number, radiusPx: number): boolean {
  return radiusPx > 0 && x * x + y * y <= radiusPx * radiusPx;
}

/**
 * The view after the globe is dragged by `dx`, `dy` pixels (right and down
 * are positive) when its radius on screen is `radiusPx`. The surface follows
 * the pointer: dragging right brings what lies to the west into view,
 * dragging down what lies to the north. A drag as long as the radius turns
 * the globe one radian, which is what a point at its centre would do.
 */
export function dragView(view: GlobeView, dx: number, dy: number, radiusPx: number): GlobeView {
  if (!(radiusPx > 0)) return view;
  const degrees = 1 / RAD / radiusPx;
  return {
    longitude: view.longitude - dx * degrees,
    latitude: Math.max(
      -MAX_DRAG_LATITUDE,
      Math.min(MAX_DRAG_LATITUDE, view.latitude + dy * degrees),
    ),
  };
}
