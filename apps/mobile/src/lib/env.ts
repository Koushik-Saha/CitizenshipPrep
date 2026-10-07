// Public configuration, inlined by Expo at build time from EXPO_PUBLIC_*
// variables (apps/mobile/.env.local in development).

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Add it to apps/mobile/.env.local.`);
  return value.replace(/\/$/, '');
}

/** The web app's origin, which serves the API. */
export const apiUrl = required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL);

/**
 * Development only: a test session from the web app's
 * /api/test/sign-in?as=token, used instead of signing in. A release build
 * ignores it, and the server only honours it on a development server.
 */
export const testSession = __DEV__ ? process.env.EXPO_PUBLIC_TEST_SESSION || null : null;

/** Neon Auth's base URL: the same value as NEON_AUTH_BASE_URL on the web app. */
export const neonAuthUrl = testSession
  ? null
  : required('EXPO_PUBLIC_NEON_AUTH_URL', process.env.EXPO_PUBLIC_NEON_AUTH_URL);

/**
 * RevenueCat's public SDK key for this platform's store, from its dashboard
 * (they start "appl_" and "goog_"). Without one, plans are shown but cannot
 * be bought in the app.
 */
export const revenueCatKeys = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || null,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || null,
};
