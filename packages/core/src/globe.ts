// Geometry and device rules for the globe on the landing page and elsewhere.
// No three.js here: the server uses this to place country markers over the
// static poster, the asset script to draw that poster, and the WebGL scene to
// draw the same globe, so all three line up exactly.

/** A unit vector: x to the right, y up, z towards the viewer. */
export type Vec3 = readonly [x: number, y: number, z: number];

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** How the globe is turned: the point at the centre of the view. */
export interface GlobeView {
  /** Latitude at the centre, in degrees. */
  latitude: number;
  /** Longitude at the centre, in degrees. */
  longitude: number;
}

const RAD = Math.PI / 180;

/**
 * A point on the unit sphere, with the same layout as three.js's
 * SphereGeometry and an equirectangular texture: longitude -180 at -x,
 * 0 at +x, -90 at +z (facing the viewer) and the north pole at +y.
 */
export function latLngToVector({ latitude, longitude }: LatLng): Vec3 {
  const phi = (longitude + 180) * RAD;
  const theta = (90 - latitude) * RAD;
  return [-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)];
}

/** The inverse of latLngToVector. Longitude is in [-180, 180). */
export function vectorToLatLng([x, y, z]: Vec3): LatLng {
  const latitude = Math.asin(Math.max(-1, Math.min(1, y))) / RAD;
  let longitude = Math.atan2(z, -x) / RAD - 180;
  if (longitude < -180) longitude += 360;
  return { latitude, longitude };
}

/**
 * The rotation that brings `view` to the centre: turn the globe about its
 * axis by `yaw`, then tilt it towards the viewer by `pitch` (both radians).
 * In three.js: an outer group with rotation.x = pitch around an inner group
 * with rotation.y = yaw.
 */
export function viewRotation(view: GlobeView): { pitch: number; yaw: number } {
  return { pitch: view.latitude * RAD, yaw: -(view.longitude + 90) * RAD };
}

/** Where a point on the globe appears, in view space. Visible when z > 0. */
export function projectToView(point: LatLng, view: GlobeView): Vec3 {
  const { pitch, yaw } = viewRotation(view);
  const [x, y, z] = latLngToVector(point);
  // Yaw: rotate about y.
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  // Pitch: rotate about x.
  return [
    x1,
    y * Math.cos(pitch) - z1 * Math.sin(pitch),
    y * Math.sin(pitch) + z1 * Math.cos(pitch),
  ];
}

/** The point on the globe seen at view-space `vector`: the inverse of projectToView. */
export function unprojectFromView([x, y, z]: Vec3, view: GlobeView): LatLng {
  const { pitch, yaw } = viewRotation(view);
  const y1 = y * Math.cos(pitch) + z * Math.sin(pitch);
  const z1 = -y * Math.sin(pitch) + z * Math.cos(pitch);
  return vectorToLatLng([
    x * Math.cos(yaw) - z1 * Math.sin(yaw),
    y1,
    x * Math.sin(yaw) + z1 * Math.cos(yaw),
  ]);
}

/**
 * The shortest turn from one longitude to another, in degrees in
 * (-180, 180], so a globe animating between them never spins the long way.
 */
export function longitudeDelta(from: number, to: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return delta === -180 ? 180 : delta;
}

/**
 * How the globe is shaded, shared by the WebGL material and the poster:
 * light from the viewer, plus a rim and an atmosphere outside the disc.
 */
export const GLOBE_SHADING = {
  /** Brightness at the limb (facing away); the centre is 1. */
  limbBrightness: 0.55,
  rimColor: [0.42, 0.54, 0.77] as Vec3,
  rimStrength: 0.55,
  rimPower: 3,
  /** The atmosphere reaches this far beyond the radius, as a fraction of it. */
  haloWidth: 0.22,
  haloStrength: 0.35,
} as const;

/** Brightness of the surface where the normal faces the viewer by `facing` (0 to 1). */
export function surfaceLight(facing: number): number {
  return GLOBE_SHADING.limbBrightness + (1 - GLOBE_SHADING.limbBrightness) * facing;
}

/** How much rim colour to add where the normal faces the viewer by `facing`. */
export function rimAmount(facing: number): number {
  return GLOBE_SHADING.rimStrength * Math.pow(1 - facing, GLOBE_SHADING.rimPower);
}

/** Atmosphere opacity at `distance` from the centre, in radii (1 is the edge). */
export function haloAlpha(distance: number): number {
  if (distance < 1) return 0;
  const t = (distance - 1) / GLOBE_SHADING.haloWidth;
  return t >= 1 ? 0 : GLOBE_SHADING.haloStrength * (1 - t) * (1 - t);
}

/** What the browser tells us about the device. Unknowns are undefined. */
export interface DeviceSignals {
  prefersReducedMotion: boolean;
  /** navigator.connection.saveData */
  saveData?: boolean;
  /** navigator.hardwareConcurrency */
  cores?: number;
  /** navigator.deviceMemory, in GB (Chromium only) */
  memoryGb?: number;
  webgl2: boolean;
}

export type SceneMode = 'globe' | 'poster';

/**
 * Whether to draw the 3D globe or keep the static poster. The globe is
 * decoration, so anything that suggests it would cost the person something
 * (motion they asked to avoid, data, a slow device) keeps the poster.
 */
export function chooseSceneMode(device: DeviceSignals): SceneMode {
  if (device.prefersReducedMotion || device.saveData || !device.webgl2) return 'poster';
  if (device.cores !== undefined && device.cores < 4) return 'poster';
  if (device.memoryGb !== undefined && device.memoryGb < 4) return 'poster';
  return 'globe';
}
