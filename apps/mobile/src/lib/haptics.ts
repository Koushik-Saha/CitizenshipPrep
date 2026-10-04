import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Touch feedback on answers. Never worth an error: phones without a haptic
// engine, the browser build and system settings that switch haptics off all
// simply do nothing.

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';
const quietly = (run: () => Promise<void>) => {
  if (enabled) run().catch(() => undefined);
};

export const haptics = {
  /** Choosing an option, flipping a card. */
  select: () => quietly(() => Haptics.selectionAsync()),
  /** A correct answer, or "knew it". */
  correct: () => quietly(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A wrong answer, or "still learning". */
  wrong: () => quietly(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** An answer recorded without a verdict (mock exams do not say). */
  recorded: () => quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Passing a mock exam. */
  celebrate: () =>
    quietly(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
