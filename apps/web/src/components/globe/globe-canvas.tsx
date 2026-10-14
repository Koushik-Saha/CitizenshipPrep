'use client';

// The 3D globe: one WebGL canvas for the whole app, loaded on idle by
// SceneHost. It moves itself into whichever <GlobeSlot> is on the page, so
// going from the landing page to the country picker reuses the same context,
// model and texture. Nothing renders unless the slot is on screen and the
// tab is visible (frameloop="demand"), and then at most 30 frames a second.

import { dragView, isOnGlobe } from '@oathly/core/globe-drag';
import {
  latLngToVector,
  longitudeDelta,
  viewRotation,
  GLOBE_SHADING,
  type GlobeView,
} from '@oathly/core/globe';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  AdditiveBlending,
  Color,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  Quaternion,
  ShaderMaterial,
  type Texture,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import { GLOBE_COLORS, IDLE_SPIN, POSTER_RADIUS } from './config';
import { sceneStore, type GlobeMarker, type Slot } from './scene-store';

const MODEL_URL = '/globe/earth.glb';
const FRAME_MS = 1000 / 30;
/** Never turn a pole to face the viewer: focus latitudes are kept within this. */
const MAX_FOCUS_LATITUDE = 35;
/** A press that moves less than this many pixels is a click, not a drag. */
const DRAG_SLOP = 6;
/** The fastest a flick may leave the globe turning, in degrees a second. */
const MAX_FLING = 140;
/** How long after a drag the globe keeps the tilt it was left at, in milliseconds. */
const TILT_HOLD_MS = 2500;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    // On a sphere the normal is the position.
    vNormal = normalize(normalMatrix * position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The same shading as the poster (drawPoster in scripts/globe/build.mts).
const earthFragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 rimColor;
  uniform float limb;
  uniform float rimStrength;
  uniform float rimPower;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    float facing = clamp(vNormal.z, 0.0, 1.0);
    vec3 base = texture2D(map, vUv).rgb;
    vec3 color = base * (limb + (1.0 - limb) * facing)
      + rimColor * rimStrength * pow(1.0 - facing, rimPower);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

const haloVertexShader = /* glsl */ `
  varying vec2 vPosition;
  void main() {
    vPosition = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const haloFragmentShader = /* glsl */ `
  uniform vec3 color;
  uniform float width;
  uniform float strength;
  varying vec2 vPosition;
  void main() {
    float t = (length(vPosition) - 1.0) / width;
    float alpha = (t < 0.0 || t >= 1.0) ? 0.0 : strength * (1.0 - t) * (1.0 - t);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

const glowFragmentShader = /* glsl */ `
  uniform vec3 color;
  uniform float intensity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 1.6) * intensity;
    gl_FragColor = vec4(color * a, a);
    #include <colorspace_fragment>
  }
`;

const glowVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function glowMaterial(color: string) {
  return new ShaderMaterial({
    vertexShader: glowVertexShader,
    fragmentShader: glowFragmentShader,
    uniforms: { color: { value: new Color(color) }, intensity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

interface MarkerHandles {
  code: string;
  group: Group;
  glow: ShaderMaterial;
  rings: Mesh[];
}

function Marker({
  marker,
  register,
  onHover,
  onSelect,
}: {
  marker: GlobeMarker;
  register: (handles: MarkerHandles | null) => void;
  onHover: (marker: GlobeMarker | null, group: Group | null) => void;
  onSelect: (code: string) => void;
}) {
  const group = useRef<Group>(null);
  const glow = useMemo(() => glowMaterial(GLOBE_COLORS.marker), []);
  const rings = useRef<Mesh[]>([]);
  const orientation = useMemo(() => {
    const [x, y, z] = latLngToVector(marker);
    const normal = new Vector3(x, y, z);
    return {
      position: normal.clone().multiplyScalar(1.002),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal),
    };
  }, [marker]);

  useEffect(() => {
    register({ code: marker.code, group: group.current!, glow, rings: rings.current });
    return () => register(null);
  }, [marker.code, glow, register]);
  useEffect(() => () => glow.dispose(), [glow]);

  const facingViewer = () => {
    const position = group.current!.getWorldPosition(new Vector3());
    return position.z > 0.25;
  };

  return (
    <group ref={group} position={orientation.position} quaternion={orientation.quaternion}>
      <mesh material={glow} renderOrder={2}>
        <planeGeometry args={[0.2, 0.2]} />
      </mesh>
      <mesh renderOrder={3}>
        <circleGeometry args={[0.016, 24]} />
        <meshBasicMaterial color={GLOBE_COLORS.marker} toneMapped={false} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            if (mesh) rings.current[i] = mesh;
          }}
          visible={false}
          renderOrder={1}
        >
          <ringGeometry args={[0.92, 1, 48]} />
          <meshBasicMaterial
            color={GLOBE_COLORS.markerHot}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* A larger, invisible target, easier to hover than the dot. */}
      <mesh
        visible={false}
        onPointerOver={(event) => {
          if (!facingViewer()) return;
          event.stopPropagation();
          onHover(marker, group.current);
        }}
        onPointerOut={() => onHover(null, null)}
        onClick={(event) => {
          if (!facingViewer()) return;
          event.stopPropagation();
          onSelect(marker.code);
        }}
      >
        <sphereGeometry args={[0.07, 8, 8]} />
      </mesh>
    </group>
  );
}

function Globe({ slot, onFirstFrame }: { slot: Slot; onFirstFrame: () => void }) {
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  // Read the camera and renderer through get() where they are changed.
  const get = useThree((state) => state.get);
  // The texture is WebP inside the model (EXT_texture_webp), which the
  // loader reads as an ordinary image. Nothing here may build code from
  // strings: the site's Content-Security-Policy forbids it, and in
  // production the globe would quietly stay a picture.
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  const earth = useMemo(() => {
    const scene = gltf.scene.clone();
    let map: Texture | null = null;
    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      map = (mesh.material as MeshBasicMaterial).map;
      mesh.material = new ShaderMaterial({
        vertexShader,
        fragmentShader: earthFragmentShader,
        uniforms: {
          map: { value: map },
          rimColor: { value: new Vector3(...GLOBE_SHADING.rimColor) },
          limb: { value: GLOBE_SHADING.limbBrightness },
          rimStrength: { value: GLOBE_SHADING.rimStrength },
          rimPower: { value: GLOBE_SHADING.rimPower },
        },
      });
    });
    return scene;
  }, [gltf]);

  const haloMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: haloVertexShader,
        fragmentShader: haloFragmentShader,
        uniforms: {
          color: { value: new Color(GLOBE_COLORS.halo) },
          width: { value: GLOBE_SHADING.haloWidth },
          strength: { value: GLOBE_SHADING.haloStrength },
        },
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  // An orthographic camera sized so the globe's radius is POSTER_RADIUS of
  // half the slot, as on the poster.
  useLayoutEffect(() => {
    const { camera } = get();
    camera.zoom = (size.width / 2) * POSTER_RADIUS;
    camera.updateProjectionMatrix();
  }, [get, size.width]);

  const tilt = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const view = useRef<GlobeView>({ ...slot.view });
  const markers = useRef(new Map<string, MarkerHandles>());
  const hovered = useRef<{ marker: GlobeMarker; group: Group } | null>(null);
  const firstFrame = useRef(true);
  const celebrationStart = useRef<number | null>(null);
  // Turning the globe by hand. `velocity` is how fast it is turning by
  // itself, in degrees a second: the idle speed, or what a flick left it at.
  const drag = useRef({
    active: false,
    pointer: -1,
    x: 0,
    y: 0,
    at: 0,
    moved: 0,
    velocity: IDLE_SPIN,
    releasedAt: Number.NEGATIVE_INFINITY,
  });

  // A new slot (another page) starts from its own view.
  const { latitude: startLatitude, longitude: startLongitude } = slot.view;
  useLayoutEffect(() => {
    view.current = { latitude: startLatitude, longitude: startLongitude };
    firstFrame.current = true;
    celebrationStart.current = null;
    hovered.current = null;
    Object.assign(drag.current, {
      active: false,
      moved: 0,
      velocity: IDLE_SPIN,
      releasedAt: Number.NEGATIVE_INFINITY,
    });
  }, [slot.id, startLatitude, startLongitude]);

  const focus = slot.focus ? slot.markers.find((marker) => marker.code === slot.focus) : null;

  // Dragging turns the globe: press on it and move. While a page has it
  // turned to one country (`focus`) it stays there. A touch that moves up or
  // down scrolls the page instead (the canvas is "pan-y"), and the browser
  // then cancels the pointer, which ends the drag.
  const canDrag = useRef(false);
  const canSelect = Boolean(slot.onSelect);
  useLayoutEffect(() => {
    canDrag.current = !focus;
  });
  useEffect(() => {
    const canvas = gl.domElement;
    const state = drag.current;
    const radius = () => (canvas.clientWidth / 2) * POSTER_RADIUS;
    const onGlobe = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      return isOnGlobe(
        event.clientX - box.left - box.width / 2,
        event.clientY - box.top - box.height / 2,
        radius(),
      );
    };
    const down = (event: PointerEvent) => {
      // Every press starts as a click, whether or not it goes on to turn the globe.
      if (!state.active) state.moved = 0;
      if (!canDrag.current || state.active || !onGlobe(event)) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      Object.assign(state, {
        active: true,
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        at: event.timeStamp,
        moved: 0,
        velocity: 0,
      });
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
      // A drag with the mouse would otherwise select the text beside the globe.
      if (event.pointerType === 'mouse') event.preventDefault();
    };
    const move = (event: PointerEvent) => {
      if (!state.active) {
        if (event.pointerType === 'mouse') {
          canvas.style.cursor =
            !canDrag.current || !onGlobe(event)
              ? ''
              : hovered.current && canSelect
                ? 'pointer'
                : 'grab';
        }
        return;
      }
      if (event.pointerId !== state.pointer) return;
      const dx = event.clientX - state.x;
      const dy = event.clientY - state.y;
      const before = view.current.longitude;
      view.current = dragView(view.current, dx, dy, radius());
      state.moved += Math.hypot(dx, dy);
      // The speed of the hand, smoothed, for the globe to carry on at when let go.
      const seconds = Math.max(1, event.timeStamp - state.at) / 1000;
      const speed = (view.current.longitude - before) / seconds;
      state.velocity = state.velocity * 0.6 + speed * 0.4;
      state.x = event.clientX;
      state.y = event.clientY;
      state.at = event.timeStamp;
    };
    const up = (event: PointerEvent) => {
      if (!state.active || event.pointerId !== state.pointer) return;
      state.active = false;
      state.releasedAt = performance.now();
      // Held still before letting go: it stays where it was put.
      if (event.timeStamp - state.at > 120) state.velocity = 0;
      state.velocity = Math.max(-MAX_FLING, Math.min(MAX_FLING, state.velocity));
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = event.type === 'pointerup' && onGlobe(event) ? 'grab' : '';
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      state.active = false;
      canvas.style.cursor = '';
    };
  }, [gl, canSelect]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const now = state.clock.elapsedTime;
    const current = view.current;
    const ease = 1 - Math.exp(-dt * 2.2);

    if (focus) {
      const latitude = Math.max(-MAX_FOCUS_LATITUDE, Math.min(MAX_FOCUS_LATITUDE, focus.latitude));
      current.longitude += longitudeDelta(current.longitude, focus.longitude) * ease;
      current.latitude += (latitude - current.latitude) * ease;
    } else if (drag.current.active) {
      // The hand has it: the pointer sets the view as it moves.
    } else if (!firstFrame.current) {
      // Left alone it turns by itself. After a flick it carries on at the
      // speed it was let go and settles back into its idle turn; the tilt it
      // was left at is kept for a moment, then eases back too.
      const state = drag.current;
      state.velocity += (IDLE_SPIN - state.velocity) * (1 - Math.exp(-dt * 1.2));
      if (!hovered.current) current.longitude += state.velocity * dt;
      const dragged = Number.isFinite(state.releasedAt);
      if (!hovered.current && performance.now() - state.releasedAt > TILT_HOLD_MS) {
        const settle = dragged ? 1 - Math.exp(-dt * 0.8) : ease;
        current.latitude += (slot.view.latitude - current.latitude) * settle;
      }
    }
    const { pitch, yaw } = viewRotation(current);
    tilt.current!.rotation.x = pitch;
    spin.current!.rotation.y = yaw;

    // Markers breathe slowly; the focused one is brighter and, when
    // celebrating, sends out rings.
    for (const handles of markers.current.values()) {
      const isFocus = handles.code === slot.focus;
      const isHovered = handles.code === hovered.current?.marker.code;
      const phase = (handles.code.charCodeAt(0) + handles.code.charCodeAt(1)) * 0.37;
      const breathe = 0.75 + 0.25 * Math.sin(now * 1.6 + phase);
      handles.glow.uniforms.intensity!.value = (isFocus || isHovered ? 2 : 1.4) * breathe;
      handles.group.scale.setScalar(isFocus || isHovered ? 1.35 : 1);
      const celebrate = isFocus && slot.scene === 'celebration';
      if (celebrate && celebrationStart.current === null) celebrationStart.current = now;
      handles.rings.forEach((ring, i) => {
        ring.visible = celebrate;
        if (!celebrate) return;
        const t = ((now - celebrationStart.current! + i * 0.55) % 1.65) / 1.65;
        ring.scale.setScalar(0.03 + t * 0.32);
        (ring.material as MeshBasicMaterial).opacity = (1 - t) * 0.9;
      });
    }

    if (firstFrame.current) {
      firstFrame.current = false;
      onFirstFrame();
    }
  });

  const register = useMemo(
    () => (code: string) => (handles: MarkerHandles | null) => {
      if (handles) markers.current.set(code, handles);
      else markers.current.delete(code);
    },
    [],
  );

  const onHover = (marker: GlobeMarker | null, group: Group | null) => {
    const { camera, gl } = get();
    // No card for whatever passes under the pointer while the globe is being turned.
    if (drag.current.active && marker) return;
    hovered.current = marker && group ? { marker, group } : null;
    if (!marker || !group) {
      sceneStore.setHover(null);
      if (!drag.current.active) gl.domElement.style.cursor = canDrag.current ? 'grab' : '';
      return;
    }
    const point = group.getWorldPosition(new Vector3()).project(camera);
    sceneStore.setHover({
      code: marker.code,
      x: ((point.x + 1) / 2) * size.width,
      y: ((1 - point.y) / 2) * size.height,
    });
    gl.domElement.style.cursor = slot.onSelect ? 'pointer' : '';
  };

  return (
    <>
      <mesh material={haloMaterial} position={[0, 0, -2]} renderOrder={-1}>
        <planeGeometry
          args={[2 * (1 + GLOBE_SHADING.haloWidth), 2 * (1 + GLOBE_SHADING.haloWidth)]}
        />
      </mesh>
      <group ref={tilt}>
        <group ref={spin}>
          <primitive object={earth} />
          {slot.markers.map((marker) => (
            <Marker
              key={marker.code}
              marker={marker}
              register={register(marker.code)}
              onHover={onHover}
              onSelect={(code) => {
                // The end of a drag is not a click on the country under it.
                if (drag.current.moved <= DRAG_SLOP) slot.onSelect?.(code);
              }}
            />
          ))}
        </group>
      </group>
    </>
  );
}

/** Renders at most 30 frames a second, and only while `active`. */
function FrameDriver({ active }: { active: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!active) return;
    let last = 0;
    let handle = requestAnimationFrame(function tick(time) {
      if (time - last >= FRAME_MS - 2) {
        last = time;
        invalidate();
      }
      handle = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(handle);
  }, [active, invalidate]);
  return null;
}

/** Keeps the poster if WebGL or the model fails: the globe is decoration. */
class KeepPoster extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn('Globe unavailable, showing the poster instead.', error);
    sceneStore.setLive(false);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useOnScreen(element: HTMLElement | null): boolean {
  const [intersecting, setIntersecting] = useState(false);
  const pageVisible = useSyncExternalStore(
    (onChange) => {
      document.addEventListener('visibilitychange', onChange);
      return () => document.removeEventListener('visibilitychange', onChange);
    },
    () => document.visibilityState === 'visible',
    () => false,
  );
  useEffect(() => {
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setIntersecting(entry!.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return Boolean(element) && intersecting && pageVisible;
}

export default function GlobeCanvas() {
  const slot = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().slot,
    () => null,
  );
  const parking = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const active = useOnScreen(slot?.element ?? null);

  // Move the canvas into the current slot, or park it when the page has none.
  useLayoutEffect(() => {
    const target = slot?.element ?? parking.current!;
    if (frame.current!.parentElement !== target) target.appendChild(frame.current!);
  }, [slot?.element]);

  // On unmount, hand the canvas back so React can remove it from its own tree.
  useLayoutEffect(() => {
    const home = parking.current!;
    const node = frame.current!;
    return () => {
      if (node.parentElement !== home) home.appendChild(node);
    };
  }, []);

  return (
    <div ref={parking} hidden>
      <div ref={frame} className="globe-frame absolute inset-0" aria-hidden="true">
        <KeepPoster>
          <Canvas
            frameloop="demand"
            orthographic
            flat
            dpr={[1, 2]}
            camera={{ position: [0, 0, 10], near: 0.1, far: 50 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
            style={{ touchAction: 'pan-y' }}
          >
            <FrameDriver active={active} />
            <Suspense fallback={null}>
              {slot && (
                <Globe
                  slot={slot}
                  onFirstFrame={() => requestAnimationFrame(() => sceneStore.setLive(true))}
                />
              )}
            </Suspense>
          </Canvas>
        </KeepPoster>
      </div>
    </div>
  );
}
