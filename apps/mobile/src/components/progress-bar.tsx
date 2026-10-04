import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '@/components/ui';

/** How far through a session the learner is. The fill glides between questions. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(value);

  useEffect(() => {
    progress.set(reduceMotion ? value : withSpring(value, theme.motion.spring.gentle));
  }, [progress, reduceMotion, theme.motion.spring.gentle, value]);

  const fill = useAnimatedStyle(() => ({ width: `${Math.min(1, progress.get()) * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{
        height: 8,
        overflow: 'hidden',
        borderRadius: theme.radii.full,
        backgroundColor: theme.colors.surfaceSunken,
      }}
    >
      <Animated.View style={[{ height: 8, backgroundColor: theme.colors.primary }, fill]} />
    </View>
  );
}
