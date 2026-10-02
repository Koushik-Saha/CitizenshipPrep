import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root, where .env.local lives. */
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Loads .env.local from the repository root. Variables already set win. */
export function loadEnv(): void {
  const file = resolve(repoRoot, '.env.local');
  if (existsSync(file)) process.loadEnvFile(file);
}
