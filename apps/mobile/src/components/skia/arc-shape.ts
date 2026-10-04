// The arc's props and size, kept apart from the drawing so they can be used
// without loading Skia (see lazy.tsx).

export interface ArcProps {
  /** 0 to 1. */
  value: number;
  /** Width in px. */
  size: number;
  /** 'half' is a gauge open at the bottom; 'full' is a ring that fills clockwise from the top. */
  shape: 'half' | 'full';
  stroke?: number;
  trackColor: string;
  fillColor: string;
}

export const arcHeight = ({
  size,
  shape,
  stroke = 14,
}: Pick<ArcProps, 'size' | 'shape' | 'stroke'>) =>
  shape === 'half' ? size / 2 + stroke / 2 : size;
