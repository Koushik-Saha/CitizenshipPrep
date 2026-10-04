import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '@/components/ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'missed';

/**
 * One answer option. Presses give a little under the finger (a spring on the
 * UI thread); after checking, the option shows whether it was right, in words
 * and colour, never colour alone.
 */
export function OptionButton({
  label,
  index,
  state,
  multiple,
  disabled,
  onPress,
}: {
  label: string;
  index: number;
  state: OptionState;
  /** Several options can be chosen (a checkbox rather than a radio button). */
  multiple: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const colors = {
    idle: [theme.colors.borderStrong, theme.colors.surface, theme.colors.fg],
    selected: [theme.colors.primary, theme.colors.primarySoft, theme.colors.fg],
    correct: [theme.colors.success, theme.colors.successSoft, theme.colors.successFg],
    wrong: [theme.colors.error, theme.colors.errorSoft, theme.colors.errorFg],
    missed: [theme.colors.success, theme.colors.surface, theme.colors.successFg],
  }[state];
  const verdict = { correct: 'Correct', wrong: 'Your answer', missed: 'Correct answer' }[
    state as 'correct' | 'wrong' | 'missed'
  ];
  const chosen = state === 'selected' || state === 'correct' || state === 'wrong';

  return (
    <AnimatedPressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ selected: chosen, checked: chosen, disabled }}
      accessibilityLabel={verdict ? `${label}. ${verdict}.` : label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        if (!reduceMotion) scale.set(withSpring(0.97, theme.motion.spring.snappy));
      }}
      onPressOut={() => scale.set(withSpring(1, theme.motion.spring.snappy))}
      testID={`option-${index}`}
      style={[
        styles.option,
        {
          borderRadius: theme.radii.md,
          borderColor: colors[0],
          backgroundColor: colors[1],
          borderWidth: state === 'idle' ? 1 : 2,
          padding: theme.spacing[4],
          gap: theme.spacing[3],
        },
        pressStyle,
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[theme.text.lg, { color: colors[2], fontWeight: chosen ? '600' : '400' }]}>
          {label}
        </Text>
        {verdict && (
          <Text style={[theme.text.sm, { color: colors[2], fontWeight: '600' }]}>{verdict}</Text>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center' },
});
