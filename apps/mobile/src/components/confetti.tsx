import { createRandom } from '@oathly/core';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

interface Piece {
  x: number;
  /** Horizontal drift and fall distance, in px over the whole animation. */
  dx: number;
  fall: number;
  /** When this piece starts, as a share of the animation. */
  delay: number;
  /** Turns over the whole fall. */
  spin: number;
  size: number;
  color: string;
}

function PieceView({ piece, progress }: { piece: Piece; progress: SharedValue<number> }) {
  // One shared value drives every piece; each works out its own place from
  // it on the UI thread, so the burst stays smooth while the results render.
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (progress.get() - piece.delay) / (1 - piece.delay)));
    return {
      opacity: t <= 0 ? 0 : Math.min(1, (1 - t) * 3),
      transform: [
        { translateX: piece.x + piece.dx * t },
        { translateY: -20 + piece.fall * t * t },
        { rotate: `${piece.spin * t * 360}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.piece,
        { width: piece.size, height: piece.size / 2, backgroundColor: piece.color },
        style,
      ]}
    />
  );
}

/**
 * A single burst of confetti falling from the top, for passing a mock exam.
 * Decoration: it takes no touches and is hidden from screen readers.
 */
export function Confetti({
  width,
  height,
  colors,
}: {
  width: number;
  height: number;
  colors: string[];
}) {
  const progress = useSharedValue(0);
  const pieces = useMemo(() => {
    // Seeded, so the burst looks the same every time rather than re-rolling on re-render.
    const random = createRandom(7);
    return Array.from({ length: 44 }, (_, i): Piece => ({
      x: random() * width,
      dx: (random() - 0.5) * width * 0.4,
      fall: height * (0.7 + random() * 0.5),
      delay: random() * 0.35,
      spin: (random() - 0.5) * 3,
      size: 8 + random() * 8,
      color: colors[i % colors.length]!,
    }));
  }, [colors, height, width]);

  useEffect(() => {
    progress.set(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }));
  }, [progress]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.layer, { width, height }]}
    >
      {pieces.map((piece, i) => (
        <PieceView key={i} piece={piece} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, overflow: 'hidden' },
  piece: { position: 'absolute', top: 0, left: 0, borderRadius: 2 },
});
