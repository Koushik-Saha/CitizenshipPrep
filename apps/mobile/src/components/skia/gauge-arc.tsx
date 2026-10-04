import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Easing, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { arcHeight, type ArcProps } from './arc-shape';

/**
 * An arc that sweeps up to its value, drawn with Skia and animated on the UI
 * thread by Reanimated (the shared value drives the path's `end` directly).
 */
export default function GaugeArc({
  value,
  size,
  shape,
  stroke = 14,
  trackColor,
  fillColor,
}: ArcProps) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const target = Math.min(1, Math.max(0, value));

  useEffect(() => {
    progress.set(
      reduceMotion
        ? target
        : withTiming(target, { duration: 650, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress, reduceMotion, target]);

  const path = useMemo(() => {
    const box = { x: stroke / 2, y: stroke / 2, width: size - stroke, height: size - stroke };
    const [from, sweep] = shape === 'half' ? [180, 180] : [-90, 359.99];
    return Skia.PathBuilder.Make().addArc(box, from, sweep).detach();
  }, [shape, size, stroke]);

  return (
    <Canvas style={{ width: size, height: arcHeight({ size, shape, stroke }) }}>
      <Path path={path} style="stroke" strokeWidth={stroke} strokeCap="round" color={trackColor} />
      {/* Nothing to draw at 0: a round cap would still show a dot. */}
      {target > 0 && (
        <Path
          path={path}
          style="stroke"
          strokeWidth={stroke}
          strokeCap="round"
          color={fillColor}
          start={0}
          end={progress}
        />
      )}
    </Canvas>
  );
}
