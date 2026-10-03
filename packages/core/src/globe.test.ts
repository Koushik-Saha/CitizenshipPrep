import { describe, expect, it } from 'vitest';

import {
  chooseSceneMode,
  haloAlpha,
  latLngToVector,
  longitudeDelta,
  projectToView,
  rimAmount,
  surfaceLight,
  unprojectFromView,
  vectorToLatLng,
  viewRotation,
  type Vec3,
} from './globe';

const expectVector = (actual: Vec3, expected: Vec3) =>
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 10));

describe('latLngToVector', () => {
  it('matches the three.js sphere layout', () => {
    expectVector(latLngToVector({ latitude: 0, longitude: 0 }), [1, 0, 0]);
    expectVector(latLngToVector({ latitude: 0, longitude: -90 }), [0, 0, 1]);
    expectVector(latLngToVector({ latitude: 0, longitude: -180 }), [-1, 0, 0]);
    expectVector(latLngToVector({ latitude: 90, longitude: 12 }), [0, 1, 0]);
  });

  it('round-trips through vectorToLatLng', () => {
    for (const point of [
      { latitude: 51.2, longitude: 10.4 },
      { latitude: -25.3, longitude: 133.8 },
      { latitude: 39.8, longitude: -98.6 },
      { latitude: 0, longitude: -180 },
    ]) {
      const back = vectorToLatLng(latLngToVector(point));
      expect(back.latitude).toBeCloseTo(point.latitude, 10);
      expect(back.longitude).toBeCloseTo(point.longitude, 10);
    }
    // Rounding can push y just past 1.
    expect(vectorToLatLng([0, 1 + 1e-12, 0]).latitude).toBe(90);
  });
});

describe('projectToView', () => {
  it('puts the view centre facing the viewer', () => {
    const view = { latitude: 22, longitude: -40 };
    expectVector(projectToView(view, view), [0, 0, 1]);
    expect(viewRotation({ latitude: 0, longitude: -90 })).toEqual({ pitch: 0, yaw: -0 });
  });

  it('shows north up and east to the right, and hides the far side', () => {
    const view = { latitude: 0, longitude: 0 };
    const east = projectToView({ latitude: 0, longitude: 30 }, view);
    const north = projectToView({ latitude: 30, longitude: 0 }, view);
    expect(east[0]).toBeGreaterThan(0);
    expect(north[1]).toBeGreaterThan(0);
    expect(projectToView({ latitude: 0, longitude: 180 }, view)[2]).toBeCloseTo(-1, 10);
  });

  it('is undone by unprojectFromView', () => {
    const view = { latitude: 22, longitude: -40 };
    const point = { latitude: 54, longitude: -2 };
    const back = unprojectFromView(projectToView(point, view), view);
    expect(back.latitude).toBeCloseTo(point.latitude, 10);
    expect(back.longitude).toBeCloseTo(point.longitude, 10);
  });
});

describe('longitudeDelta', () => {
  it('takes the short way round', () => {
    expect(longitudeDelta(170, -170)).toBe(20);
    expect(longitudeDelta(-170, 170)).toBe(-20);
    expect(longitudeDelta(0, 180)).toBe(180);
    expect(longitudeDelta(0, -180)).toBe(180);
    expect(longitudeDelta(10, 10)).toBe(0);
  });
});

describe('shading', () => {
  it('is brightest facing the viewer, with the rim at the edge', () => {
    expect(surfaceLight(1)).toBe(1);
    expect(surfaceLight(0)).toBeCloseTo(0.55, 10);
    expect(rimAmount(1)).toBe(0);
    expect(rimAmount(0)).toBeCloseTo(0.55, 10);
  });

  it('fades the atmosphere out beyond the edge', () => {
    expect(haloAlpha(0.5)).toBe(0);
    expect(haloAlpha(1)).toBeCloseTo(0.35, 10);
    expect(haloAlpha(1.11)).toBeCloseTo(0.35 * 0.25, 10);
    expect(haloAlpha(1.3)).toBe(0);
  });
});

describe('chooseSceneMode', () => {
  const capable = { prefersReducedMotion: false, webgl2: true };

  it('draws the globe on a capable device, including when some signals are unknown', () => {
    expect(chooseSceneMode(capable)).toBe('globe');
    expect(chooseSceneMode({ ...capable, cores: 8, memoryGb: 8, saveData: false })).toBe('globe');
  });

  it('keeps the poster for reduced motion, data saving, no WebGL 2 or a low-end device', () => {
    expect(chooseSceneMode({ ...capable, prefersReducedMotion: true })).toBe('poster');
    expect(chooseSceneMode({ ...capable, saveData: true })).toBe('poster');
    expect(chooseSceneMode({ ...capable, webgl2: false })).toBe('poster');
    expect(chooseSceneMode({ ...capable, cores: 2 })).toBe('poster');
    expect(chooseSceneMode({ ...capable, memoryGb: 2 })).toBe('poster');
  });
});
