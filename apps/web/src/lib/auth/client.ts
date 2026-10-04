'use client';

import { createAuthClient } from '@neondatabase/auth/next';

// Talks to Neon Auth through this app's /api/auth route, so the session lives
// in this site's own cookies.
//
// The client is about 100 KB (better-auth and zod), so pages never import it
// directly: loadAuthClient() fetches it when someone is about to use it.
export const authClient = createAuthClient();
