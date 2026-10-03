// Public configuration, inlined by Expo at build time from EXPO_PUBLIC_*
// variables (apps/mobile/.env.local in development).

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Add it to apps/mobile/.env.local.`);
  return value.replace(/\/$/, '');
}

/** Neon Auth's base URL: the same value as NEON_AUTH_BASE_URL on the web app. */
export const neonAuthUrl = required(
  'EXPO_PUBLIC_NEON_AUTH_URL',
  process.env.EXPO_PUBLIC_NEON_AUTH_URL,
);

/** The web app's origin, which serves the API. */
export const apiUrl = required('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL);
