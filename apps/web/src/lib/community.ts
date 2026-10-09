import { createScreener, type Screener } from '@oathly/api/server';

import { getGenerator } from './ai';

/**
 * Reads a post before it is shown to anyone. With a model configured, every
 * post is screened by it, and one it cannot read waits for a moderator.
 * Without one (a development server), the built-in rules decide alone.
 */
export function getScreener(): Screener {
  return createScreener(process.env.ANTHROPIC_API_KEY ? getGenerator() : null);
}
