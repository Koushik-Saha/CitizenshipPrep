'use client';

/**
 * The Neon Auth client, downloaded on demand. Call it early (on focus or
 * hover) to warm it up; later calls reuse the same promise.
 */
let pending: Promise<typeof import('./client').authClient> | null = null;

export function loadAuthClient() {
  pending ??= import('./client').then((module) => module.authClient);
  return pending;
}
