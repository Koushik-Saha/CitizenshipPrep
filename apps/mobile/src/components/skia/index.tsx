import { arcHeight, type ArcProps } from './arc-shape';
import { lazySkia } from './lazy';

/** A half gauge or full ring that sweeps to its value, drawn with Skia. */
export const Arc = lazySkia<ArcProps>(
  () => import('./gauge-arc'),
  (props) => ({ width: props.size, height: arcHeight(props) }),
);
