import { useEffect } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/components/ui';

/** How far a card must be dragged, as a share of the screen, to count as a swipe. */
const SWIPE_SHARE = 0.28;

/**
 * One flashcard. Tap to turn it over; once the answer shows, swipe right for
 * "knew it" or left for "still learning". The drag, the turn and the fly-off
 * all run on the UI thread (Reanimated worklets), so they stay smooth while
 * the next card is prepared. The buttons under the card do the same things
 * for people who do not swipe.
 */
export function Flashcard({
  front,
  back,
  footnote,
  flipped,
  lang,
  onFlip,
  onSwipe,
}: {
  front: string;
  back: string;
  /** Shown under the answer: the explanation. */
  footnote: string | null;
  flipped: boolean;
  /** The language the card is written in, for screen readers. */
  lang: string;
  onFlip: () => void;
  onSwipe: (knewIt: boolean) => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const turn = useSharedValue(0);

  useEffect(() => {
    const target = flipped ? 1 : 0;
    turn.set(reduceMotion ? target : withSpring(target, theme.motion.spring.gentle));
  }, [flipped, reduceMotion, theme.motion.spring.gentle, turn]);

  const pan = Gesture.Pan()
    // Leave vertical drags to the scroll view around the card.
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onChange((event) => {
      // Before the answer shows, the card resists: there is nothing to rate yet.
      x.set(x.get() + event.changeX * (flipped ? 1 : 0.25));
    })
    .onEnd((event) => {
      const far = Math.abs(x.get()) > width * SWIPE_SHARE || Math.abs(event.velocityX) > 900;
      if (flipped && far) {
        const knewIt = x.get() > 0;
        x.set(
          withTiming((knewIt ? 1 : -1) * width * 1.3, { duration: reduceMotion ? 0 : 180 }, () => {
            scheduleOnRN(onSwipe, knewIt);
          }),
        );
      } else {
        x.set(withSpring(0, theme.motion.spring.snappy));
      }
    });
  const tap = Gesture.Tap().onEnd(() => {
    if (!flipped) scheduleOnRN(onFlip);
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { rotate: `${interpolate(x.get(), [-width, width], [-10, 10], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: turn.get() < 0.5 ? 1 : 0,
    transform: [{ perspective: 1000 }, { rotateY: `${turn.get() * 180}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: turn.get() < 0.5 ? 0 : 1,
    transform: [{ perspective: 1000 }, { rotateY: `${turn.get() * 180 - 180}deg` }],
  }));
  // The verdict the drag is heading for, fading in as the card moves.
  const knewStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, width * SWIPE_SHARE], [0, 1], Extrapolation.CLAMP),
  }));
  const learningStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [-width * SWIPE_SHARE, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const face = [
    styles.face,
    {
      padding: theme.spacing[6],
      borderRadius: theme.radii.xl,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
  ];
  const badge = [
    styles.badge,
    { top: theme.spacing[4], borderRadius: theme.radii.full, paddingHorizontal: theme.spacing[3] },
  ];

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={flipped ? `Answer: ${back}` : `${front}. Tap to show the answer.`}
        accessibilityLanguage={lang}
        testID="flashcard"
        style={[styles.card, cardStyle]}
      >
        <Animated.View style={[face, frontStyle]}>
          <Text style={[theme.text['2xl'], { color: theme.colors.fg, fontWeight: '600' }]}>
            {front}
          </Text>
          <Text style={[theme.text.sm, { color: theme.colors.fgMuted }]}>
            Tap to show the answer
          </Text>
        </Animated.View>
        <Animated.View style={[face, styles.back, backStyle]}>
          <Text style={[theme.text.sm, { color: theme.colors.fgMuted }]}>Answer</Text>
          <Text style={[theme.text['2xl'], { color: theme.colors.fg, fontWeight: '600' }]}>
            {back}
          </Text>
          {footnote && (
            <Text style={[theme.text.base, { color: theme.colors.fgMuted }]}>{footnote}</Text>
          )}
          <Animated.View
            style={[
              badge,
              { right: theme.spacing[4], backgroundColor: theme.colors.successSoft },
              knewStyle,
            ]}
          >
            <Text style={[theme.text.sm, { color: theme.colors.successFg, fontWeight: '600' }]}>
              Knew it
            </Text>
          </Animated.View>
          <Animated.View
            style={[
              badge,
              { left: theme.spacing[4], backgroundColor: theme.colors.errorSoft },
              learningStyle,
            ]}
          >
            <Text style={[theme.text.sm, { color: theme.colors.errorFg, fontWeight: '600' }]}>
              Still learning
            </Text>
          </Animated.View>
        </Animated.View>
        {/* Keeps the card's height: both faces are absolutely placed. */}
        <View style={styles.spacer} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  spacer: { height: 320 },
  face: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    gap: 12,
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
  },
  back: {},
  badge: { position: 'absolute', paddingVertical: 4 },
});
