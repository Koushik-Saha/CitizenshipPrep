'use client';

import type { GlobeView } from '@oathly/core/globe';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { sceneStore, type GlobeMarker, type SceneName } from './scene-store';

interface Props {
  scene: SceneName;
  view: GlobeView;
  markers: GlobeMarker[];
  focus?: string | null;
  /** Called with a country code when someone picks a country on the globe. */
  onSelect?: (code: string) => void;
  /** Or: where picking a country goes, with `{code}` replaced. */
  selectHref?: string;
  className?: string;
  /** The <GlobePoster>, shown until the 3D globe draws its first frame. */
  children: ReactNode;
}

/**
 * Where the globe appears on a page. Shows the poster, registers with the
 * scene store so the shared canvas can move in, and shows the hover card.
 * Square: the poster and the 3D scene both assume it.
 */
export function GlobeSlot({
  scene,
  view,
  markers,
  focus = null,
  onSelect,
  selectHref,
  className = '',
  children,
}: Props) {
  const id = useId();
  const element = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const live = useSyncExternalStore(
    sceneStore.subscribe,
    () => sceneStore.getState().live && sceneStore.getState().slot?.id === id,
    () => false,
  );
  const hover = useSyncExternalStore(
    sceneStore.subscribe,
    () => (sceneStore.getState().slot?.id === id ? sceneStore.getState().hover : null),
    () => null,
  );

  const select =
    onSelect ??
    (selectHref ? (code: string) => router.push(selectHref.replace('{code}', code)) : undefined);
  const latest = useRef({ scene, view, markers, focus, select });
  useLayoutEffect(() => {
    latest.current = { scene, view, markers, focus, select };
  });

  // Register once; the canvas follows this element until it unmounts.
  useEffect(() => {
    const current = latest.current;
    return sceneStore.register({
      id,
      element: element.current!,
      scene: current.scene,
      view: current.view,
      markers: current.markers,
      focus: current.focus,
      onSelect: (code) => latest.current.select?.(code),
    });
  }, [id]);

  useEffect(() => {
    sceneStore.update(id, { scene, markers, focus });
  }, [id, scene, markers, focus]);

  const card = hover ? markers.find((marker) => marker.code === hover.code) : undefined;

  return (
    <div ref={element} className={`relative aspect-square ${className}`}>
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${live ? 'opacity-0' : ''}`}
        aria-hidden="true"
      >
        {children}
      </div>
      {card && hover && (
        <div
          className="bg-surface-raised text-fg border-border pointer-events-none absolute z-10 w-max max-w-64 rounded-md border px-3 py-2 text-sm shadow-lg"
          style={{
            left: hover.x,
            top: hover.y,
            transform: 'translate(-50%, calc(-100% - 18px))',
          }}
          aria-hidden="true"
        >
          <p className="font-display font-medium">{card.name}</p>
          {card.facts.map((fact) => (
            <p key={fact} className="text-fg-muted">
              {fact}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
