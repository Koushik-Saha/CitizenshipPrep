'use client';

import { createAuthClient } from '@neondatabase/auth/next';

// Talks to Neon Auth through this app's /api/auth route, so the session lives
// in this site's own cookies.
export const authClient = createAuthClient();
