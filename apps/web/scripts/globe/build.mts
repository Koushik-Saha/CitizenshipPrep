// Builds the globe assets in public/globe:
//
//   earth.glb    a sphere with a halftone land texture: Meshopt-compressed
//                geometry, KTX2 (Basis ETC1S) texture embedded
//   poster-*.webp  the same globe drawn in software, shown in the page's HTML
//                and kept on devices that do not get the 3D globe
//   basis/       the KTX2 transcoder three.js loads in the browser
//
// and, in apps/mobile/assets/globe, the land as a list of dots plus a poster
// for the phone app's welcome screen.
//
// Countries are not drawn into any of these: the page places them from the
// database. Land outlines are Natural Earth's 1:110m land (public domain).
//
// Run: pnpm --filter @oathly/web globe:assets   (needs cwebp on the PATH)

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

import { Document, NodeIO } from '@gltf-transform/core';
import {
  EXTMeshoptCompression,
  KHRMaterialsUnlit,
  KHRMeshQuantization,
  KHRTextureBasisu,
} from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { encodeToKTX2 } from 'ktx2-encoder';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

import {
  haloAlpha,
  rimAmount,
  surfaceLight,
  unprojectFromView,
  GLOBE_SHADING,
} from '@oathly/core/globe';

import {
  GLOBE_COLORS,
  HERO_VIEW,
  POSTER_SIZES,
  POSTER_RADIUS,
} from '../../src/components/globe/config';

const LAND_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_land.geojson';

const OUT = path.resolve(import.meta.dirname, '../../public/globe');
const MOBILE_OUT = path.resolve(import.meta.dirname, '../../../mobile/assets/globe');
/** Spacing of the phone app's land dots, in degrees. */
const MOBILE_DOT_STEP = 2.2;
const MOBILE_POSTER = 720;
const TEXTURE_WIDTH = 2048;
const TEXTURE_HEIGHT = 1024;
/** Spacing of the halftone dots, in degrees of latitude. */
const DOT_STEP = 1.25;
const DOT_RADIUS = DOT_STEP * 0.34;

type Ring = [number, number][];
type Polygon = Ring[];

interface Raster {
  width: number;
  height: number;
  data: Uint8Array;
}

function hex(color: string): [number, number, number] {
  const n = Number.parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function loadLand(): Promise<Polygon[]> {
  const response = await fetch(LAND_URL);
  if (!response.ok) throw new Error(`Could not download land outlines: HTTP ${response.status}`);
  const geojson = (await response.json()) as {
    features: { geometry: { type: string; coordinates: unknown } }[];
  };
  const polygons: Polygon[] = [];
  for (const { geometry } of geojson.features) {
    if (geometry.type === 'Polygon') polygons.push(geometry.coordinates as Polygon);
    else if (geometry.type === 'MultiPolygon')
      polygons.push(...(geometry.coordinates as Polygon[]));
  }
  return polygons;
}

function landTest(polygons: Polygon[]) {
  const boxes = polygons.map((polygon) => {
    const outer = polygon[0]!;
    const lngs = outer.map(([lng]) => lng);
    const lats = outer.map(([, lat]) => lat);
    return [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)] as const;
  });
  // Even-odd ray casting over every ring, so holes (lakes) come out as water.
  return (lng: number, lat: number): boolean =>
    polygons.some((polygon, i) => {
      const [minLng, maxLng, minLat, maxLat] = boxes[i]!;
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return false;
      let inside = false;
      for (const ring of polygon) {
        for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
          const [x1, y1] = ring[a]!;
          const [x2, y2] = ring[b]!;
          if (y1 > lat !== y2 > lat && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) {
            inside = !inside;
          }
        }
      }
      return inside;
    });
}

/**
 * The land as evenly spaced dots, for the phone app: a flat list of
 * latitude, longitude pairs in tenths of a degree.
 */
function landDots(isLand: (lng: number, lat: number) => boolean): number[] {
  const dots: number[] = [];
  for (let lat = 90 - MOBILE_DOT_STEP / 2; lat > -90; lat -= MOBILE_DOT_STEP) {
    const count = Math.max(
      1,
      Math.round((360 * Math.cos(lat * (Math.PI / 180))) / MOBILE_DOT_STEP),
    );
    for (let i = 0; i < count; i += 1) {
      const lng = -180 + (360 * (i + 0.5)) / count;
      if (isLand(lng, lat)) dots.push(Math.round(lat * 10), Math.round(lng * 10));
    }
  }
  return dots;
}

/**
 * An equirectangular texture: deep ocean with land as a halftone of round
 * dots. Dots are spaced evenly over the sphere's surface (fewer per row
 * towards the poles) and stretched in the texture so they look round on it.
 */
function drawTexture(isLand: (lng: number, lat: number) => boolean): Raster {
  const width = TEXTURE_WIDTH;
  const height = TEXTURE_HEIGHT;
  const ocean = hex(GLOBE_COLORS.ocean);
  const land = hex(GLOBE_COLORS.land);
  const coverage = new Float32Array(width * height);
  const degPerPixel = 180 / height;

  for (let lat = 90 - DOT_STEP / 2; lat > -90; lat -= DOT_STEP) {
    const stretch = Math.max(Math.cos(lat * (Math.PI / 180)), 0.08);
    const count = Math.max(1, Math.round((360 * stretch) / DOT_STEP));
    for (let i = 0; i < count; i += 1) {
      const lng = -180 + (360 * (i + 0.5)) / count;
      if (!isLand(lng, lat)) continue;
      const reachLat = DOT_RADIUS + degPerPixel;
      const reachLng = reachLat / stretch;
      const y0 = Math.max(0, Math.floor(((90 - lat - reachLat) / 180) * height));
      const y1 = Math.min(height - 1, Math.ceil(((90 - lat + reachLat) / 180) * height));
      const x0 = Math.floor(((lng + 180 - reachLng) / 360) * width);
      const x1 = Math.ceil(((lng + 180 + reachLng) / 360) * width);
      for (let y = y0; y <= y1; y += 1) {
        const pixelLat = 90 - ((y + 0.5) / height) * 180;
        for (let x = x0; x <= x1; x += 1) {
          const pixelLng = -180 + ((x + 0.5) / width) * 360;
          const dLat = pixelLat - lat;
          const dLng = (pixelLng - lng) * stretch;
          const distance = Math.hypot(dLat, dLng);
          const value = Math.min(1, Math.max(0, (DOT_RADIUS - distance) / degPerPixel + 0.5));
          if (value <= 0) continue;
          const wrapped = ((x % width) + width) % width;
          const index = y * width + wrapped;
          coverage[index] = Math.max(coverage[index]!, value);
        }
      }
    }
  }

  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < coverage.length; i += 1) {
    const c = coverage[i]!;
    for (let k = 0; k < 3; k += 1)
      data[i * 4 + k] = Math.round(ocean[k]! + (land[k]! - ocean[k]!) * c);
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

function sample(texture: Raster, lng: number, lat: number): [number, number, number] {
  const fx = ((lng + 180) / 360) * texture.width - 0.5;
  const fy = ((90 - lat) / 180) * texture.height - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.max(0, Math.min(texture.height - 1, Math.floor(fy)));
  const y1 = Math.min(texture.height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = Math.max(0, Math.min(1, fy - y0));
  const at = (x: number, y: number, k: number) =>
    texture.data[
      (y * texture.width + (((x % texture.width) + texture.width) % texture.width)) * 4 + k
    ]!;
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k += 1) {
    const top = at(x0, y0, k) * (1 - tx) + at(x0 + 1, y0, k) * tx;
    const bottom = at(x0, y1, k) * (1 - tx) + at(x0 + 1, y1, k) * tx;
    out[k] = top * (1 - ty) + bottom * ty;
  }
  return out;
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const toSrgb = (v: number) =>
  Math.round(
    255 *
      Math.min(1, Math.max(0, v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)),
  );

/**
 * The globe as the WebGL scene draws it at rest (see globe-scene.tsx), with
 * a transparent background: same view, same shading, same atmosphere.
 * Shading happens in linear light, as three.js does.
 */
function drawPoster(texture: Raster, size: number): Raster {
  const data = new Uint8Array(size * size * 4);
  const radius = (size / 2) * POSTER_RADIUS;
  const rim = GLOBE_SHADING.rimColor;
  const halo = hex(GLOBE_COLORS.halo).map(toLinear);
  const samples = 3; // per axis, for smooth edges
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples - size / 2) / radius;
          const y = -(py + (sy + 0.5) / samples - size / 2) / radius;
          const d2 = x * x + y * y;
          if (d2 <= 1) {
            const z = Math.sqrt(1 - d2);
            const { latitude, longitude } = unprojectFromView([x, y, z], HERO_VIEW);
            const color = sample(texture, longitude, latitude).map(toLinear);
            const light = surfaceLight(z);
            const rimMix = rimAmount(z);
            r += color[0]! * light + rim[0] * rimMix;
            g += color[1]! * light + rim[1] * rimMix;
            b += color[2]! * light + rim[2] * rimMix;
            a += 1;
          } else {
            // Premultiplied, so the atmosphere blends with the edge samples.
            const alpha = haloAlpha(Math.sqrt(d2));
            r += halo[0]! * alpha;
            g += halo[1]! * alpha;
            b += halo[2]! * alpha;
            a += alpha;
          }
        }
      }
      const n = samples * samples;
      const i = (py * size + px) * 4;
      const alpha = a / n;
      data[i] = alpha > 0 ? toSrgb(r / n / alpha) : 0;
      data[i + 1] = alpha > 0 ? toSrgb(g / n / alpha) : 0;
      data[i + 2] = alpha > 0 ? toSrgb(b / n / alpha) : 0;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  return { width: size, height: size, data };
}

function png({ width, height, data }: Raster): Buffer {
  const chunk = (type: string, body: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    rows.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * A UV sphere laid out like three.js's SphereGeometry, with glTF's top-down
 * texture rows. No normals: on a unit sphere the normal is the position, and
 * the scene's shader uses that, which keeps the file smaller.
 */
function sphere(widthSegments: number, heightSegments: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let iy = 0; iy <= heightSegments; iy += 1) {
    const v = iy / heightSegments;
    for (let ix = 0; ix <= widthSegments; ix += 1) {
      const u = ix / widthSegments;
      const x = -Math.cos(u * Math.PI * 2) * Math.sin(v * Math.PI);
      const y = Math.cos(v * Math.PI);
      const z = Math.sin(u * Math.PI * 2) * Math.sin(v * Math.PI);
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }
  const row = widthSegments + 1;
  for (let iy = 0; iy < heightSegments; iy += 1) {
    for (let ix = 0; ix < widthSegments; ix += 1) {
      const a = iy * row + ix + 1;
      const b = iy * row + ix;
      const c = (iy + 1) * row + ix;
      const d = (iy + 1) * row + ix + 1;
      if (iy !== 0) indices.push(a, b, d);
      if (iy !== heightSegments - 1) indices.push(b, c, d);
    }
  }
  return {
    positions: new Float32Array(positions),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

async function buildModel(ktx2: Uint8Array): Promise<Uint8Array> {
  await MeshoptEncoder.ready;
  const document = new Document();
  document.createExtension(KHRTextureBasisu).setRequired(true);
  const unlit = document.createExtension(KHRMaterialsUnlit);
  const buffer = document.createBuffer();
  const geometry = sphere(72, 48);
  const primitive = document
    .createPrimitive()
    .setIndices(
      document.createAccessor().setType('SCALAR').setArray(geometry.indices).setBuffer(buffer),
    )
    .setAttribute(
      'POSITION',
      document.createAccessor().setType('VEC3').setArray(geometry.positions).setBuffer(buffer),
    )
    .setAttribute(
      'TEXCOORD_0',
      document.createAccessor().setType('VEC2').setArray(geometry.uvs).setBuffer(buffer),
    );
  const texture = document.createTexture('earth').setMimeType('image/ktx2').setImage(ktx2);
  const material = document
    .createMaterial('earth')
    .setBaseColorTexture(texture)
    .setExtension('KHR_materials_unlit', unlit.createUnlit());
  primitive.setMaterial(material);
  const mesh = document.createMesh('earth').addPrimitive(primitive);
  document.createScene().addChild(document.createNode('earth').setMesh(mesh));

  await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const io = new NodeIO()
    .registerExtensions([
      EXTMeshoptCompression,
      KHRMeshQuantization,
      KHRTextureBasisu,
      KHRMaterialsUnlit,
    ])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  return io.writeBinary(document);
}

async function main() {
  mkdirSync(path.join(OUT, 'basis'), { recursive: true });

  console.log('Drawing the land texture…');
  const isLand = landTest(await loadLand());
  const texture = drawTexture(isLand);

  console.log('Encoding KTX2…');
  const ktx2 = await encodeToKTX2(new Uint8Array(0), {
    enableDebug: false,
    isUASTC: false,
    generateMipmap: true,
    qualityLevel: 160,
    compressionLevel: 4,
    isPerceptual: true,
    isSetKTX2SRGBTransferFunc: true,
    imageDecoder: async () => texture,
  });

  console.log('Building the model…');
  const glb = await buildModel(ktx2);
  writeFileSync(path.join(OUT, 'earth.glb'), glb);

  console.log('Drawing the posters…');
  const scratch = mkdtempSync(path.join(tmpdir(), 'oathly-globe-'));
  for (const size of POSTER_SIZES) {
    const source = path.join(scratch, `poster-${size}.png`);
    writeFileSync(source, png(drawPoster(texture, size)));
    execFileSync('cwebp', [
      '-quiet',
      '-q',
      '74',
      '-alpha_q',
      '80',
      '-m',
      '6',
      source,
      '-o',
      path.join(OUT, `poster-${size}.webp`),
    ]);
  }

  const require = createRequire(import.meta.url);
  // three's main entry is build/three.cjs; the transcoder ships beside it.
  const basis = path.resolve(path.dirname(require.resolve('three')), '../examples/jsm/libs/basis');
  for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
    copyFileSync(path.join(basis, file), path.join(OUT, 'basis', file));
  }

  // The phone app draws the land as points rather than a texture, and keeps
  // one poster for devices that do not get the 3D globe.
  mkdirSync(MOBILE_OUT, { recursive: true });
  const dots = landDots(isLand);
  writeFileSync(path.join(MOBILE_OUT, 'land-dots.json'), `${JSON.stringify(dots)}\n`);
  copyFileSync(
    path.join(OUT, `poster-${MOBILE_POSTER}.webp`),
    path.join(MOBILE_OUT, 'poster.webp'),
  );
  console.log(`Wrote ${MOBILE_OUT}: ${dots.length / 2} land dots and the poster.`);

  const sizes = ['earth.glb', ...POSTER_SIZES.map((size) => `poster-${size}.webp`)].map(
    (file) => `${file} ${(readFileSync(path.join(OUT, file)).length / 1024).toFixed(1)} KB`,
  );
  console.log(
    `Wrote ${OUT}:\n  ${sizes.join('\n  ')}\n  (texture ${(ktx2.length / 1024).toFixed(1)} KB)`,
  );
}

await main();
