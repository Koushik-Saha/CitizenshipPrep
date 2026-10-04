import { router } from 'expo-router';

/**
 * Leaves a session for the Study tab. Goes back to the tab that is already
 * open underneath rather than putting a second copy on the stack.
 */
export function backToStudy(): void {
  if (router.canDismiss()) router.dismissTo('/study');
  else router.replace('/study');
}
