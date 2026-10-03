import { projectToView, type GlobeView } from '@oathly/core/globe';
import { preload } from 'react-dom';

import { GLOBE_COLORS, PHONE_POSTER, POSTER_RADIUS, POSTER_SIZES } from './config';
import type { GlobeMarker } from './scene-store';

const poster = (size: number) => `/globe/poster-${size}.webp`;
const srcSet = POSTER_SIZES.filter((size) => size > PHONE_POSTER.size)
  .map((size) => `${poster(size)} ${size}w`)
  .join(', ');
const largest = Math.max(...POSTER_SIZES);
const notPhone = '(min-width: 640px)';

/**
 * The static globe: a pre-rendered image plus the countries drawn over it
 * from data, at the positions the 3D globe puts them. This is what is in the
 * HTML, what devices without the 3D globe keep, and what reduced-motion
 * users see.
 */
export function GlobePoster({
  view,
  markers,
  focus = null,
  sizes,
  priority = false,
}: {
  view: GlobeView;
  markers: GlobeMarker[];
  focus?: string | null;
  /** The `sizes` attribute: how wide the slot is at each breakpoint. */
  sizes: string;
  /** The page's main image: preload it and fetch it first. */
  priority?: boolean;
}) {
  if (priority) {
    preload(poster(PHONE_POSTER.size), {
      as: 'image',
      media: PHONE_POSTER.media,
      fetchPriority: 'high',
    });
    preload(poster(largest), {
      as: 'image',
      media: notPhone,
      imageSrcSet: srcSet,
      imageSizes: sizes,
      fetchPriority: 'high',
    });
  }
  const placed = markers
    .map((marker) => ({ marker, point: projectToView(marker, view) }))
    .filter(({ point }) => point[2] > 0.2);

  return (
    <>
      <picture>
        <source media={PHONE_POSTER.media} srcSet={poster(PHONE_POSTER.size)} />
        <img
          src={poster(largest)}
          srcSet={srcSet}
          sizes={sizes}
          width={largest}
          height={largest}
          alt=""
          fetchPriority={priority ? 'high' : undefined}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="absolute inset-0 size-full select-none"
          draggable={false}
        />
      </picture>
      <svg viewBox="-1 -1 2 2" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <radialGradient id="globe-marker-glow">
            <stop offset="0" stopColor={GLOBE_COLORS.marker} stopOpacity="0.85" />
            <stop offset="1" stopColor={GLOBE_COLORS.marker} stopOpacity="0" />
          </radialGradient>
        </defs>
        {placed.map(({ marker, point: [x, y] }) => {
          const scale = marker.code === focus ? 1.35 : 1;
          return (
            <g
              key={marker.code}
              transform={`translate(${x * POSTER_RADIUS} ${-y * POSTER_RADIUS}) scale(${scale})`}
            >
              <circle r={0.065 * POSTER_RADIUS} fill="url(#globe-marker-glow)" />
              <circle r={0.016 * POSTER_RADIUS} fill={GLOBE_COLORS.marker} />
            </g>
          );
        })}
      </svg>
    </>
  );
}
