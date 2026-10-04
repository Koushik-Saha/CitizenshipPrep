import { HERO_VIEW, latLngToVector, viewRotation } from '@oathly/core/globe';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  type Group,
} from 'three';

import landDots from '@/assets/globe/land-dots.json';

import { Canvas, useFrame, useThree } from './r3f';

export interface GlobeMarker {
  code: string;
  latitude: number;
  longitude: number;
}

export interface GlobeSceneProps {
  markers: GlobeMarker[];
  colors: { ocean: string; land: string; marker: string; halo: string };
  /** Turn slowly. Off for reduced motion and when the screen is not in front. */
  spinning: boolean;
}

/** The globe's radius as a share of half the canvas width, as on the poster. */
const RADIUS_SHARE = 0.8;
/** Degrees of longitude per second. */
const SPIN = 2;

// Land is drawn as points, one per dot in land-dots.json: no texture to load
// or decode, and a few thousand points cost a phone's GPU almost nothing.
const pointVertex = /* glsl */ `
  uniform float size;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size;
  }
`;
const pointFragment = /* glsl */ `
  uniform vec3 color;
  void main() {
    vec2 fromCentre = gl_PointCoord - 0.5;
    if (dot(fromCentre, fromCentre) > 0.25) discard;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

function Scene({ markers, colors, spinning }: GlobeSceneProps) {
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  const get = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);
  const spin = useRef<Group>(null);
  const longitude = useRef(HERO_VIEW.longitude);
  const halos = useRef<(Group | null)[]>([]);

  useLayoutEffect(() => {
    const { camera } = get();
    camera.zoom = (Math.min(size.width, size.height) / 2) * RADIUS_SHARE;
    camera.updateProjectionMatrix();
    invalidate();
  }, [get, invalidate, size.height, size.width]);

  const land = useMemo(() => {
    const positions = new Float32Array((landDots.length / 2) * 3);
    for (let i = 0; i < landDots.length; i += 2) {
      const point = latLngToVector({
        latitude: landDots[i]! / 10,
        longitude: landDots[i + 1]! / 10,
      });
      positions.set(point, (i / 2) * 3);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    return geometry;
  }, []);

  // Dots keep the same share of the globe whatever the screen size.
  const dotSize = Math.max(2, (size.width / 150) * dpr);
  const dotMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: pointVertex,
        fragmentShader: pointFragment,
        uniforms: { size: { value: dotSize }, color: { value: new Color(colors.land) } },
      }),
    [colors.land, dotSize],
  );
  useEffect(() => () => dotMaterial.dispose(), [dotMaterial]);

  const placed = useMemo(
    () => markers.map((marker) => ({ code: marker.code, position: latLngToVector(marker) })),
    [markers],
  );

  useFrame((state, delta) => {
    if (spinning) longitude.current += SPIN * Math.min(delta, 0.1);
    spin.current!.rotation.y = viewRotation({
      latitude: HERO_VIEW.latitude,
      longitude: longitude.current,
    }).yaw;
    // Each country's halo breathes, a little out of step with the others.
    halos.current.forEach((halo, i) => {
      halo?.scale.setScalar(1 + 0.35 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 1.8 + i)));
    });
  });

  return (
    <>
      <mesh scale={1.07}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial color={colors.halo} side={BackSide} transparent opacity={0.16} />
      </mesh>
      <group rotation={[viewRotation(HERO_VIEW).pitch, 0, 0]}>
        <group ref={spin}>
          {/* Just inside the dots, so it hides the ones on the far side. */}
          <mesh scale={0.992}>
            <sphereGeometry args={[1, 48, 32]} />
            <meshBasicMaterial color={colors.ocean} />
          </mesh>
          <points geometry={land} material={dotMaterial} />
          {placed.map((marker, i) => (
            <group key={marker.code} position={marker.position}>
              <mesh>
                <sphereGeometry args={[0.02, 12, 12]} />
                <meshBasicMaterial color={colors.marker} />
              </mesh>
              <group
                ref={(group) => {
                  halos.current[i] = group;
                }}
              >
                <mesh>
                  <sphereGeometry args={[0.045, 12, 12]} />
                  <meshBasicMaterial color={colors.marker} transparent opacity={0.3} />
                </mesh>
              </group>
            </group>
          ))}
        </group>
      </group>
    </>
  );
}

/** The welcome screen's globe. Square; fills its parent. */
export default function GlobeScene(props: GlobeSceneProps) {
  return (
    <Canvas
      orthographic
      flat
      // Nothing moves when it is not spinning, so nothing needs redrawing.
      frameloop={props.spinning ? 'always' : 'demand'}
      camera={{ position: [0, 0, 10], near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
