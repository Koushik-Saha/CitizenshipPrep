import { existsSync } from 'node:fs';
import path from 'node:path';

import type { NextConfig } from 'next';

// Secrets live in one .env.local at the repository root, shared with the
// content CLI and the database scripts. Next only reads apps/web/.env*, so
// load the root file here. On a host, the platform sets these instead.
const rootEnv = path.resolve(process.cwd(), '../../.env.local');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ['@oathly/content', '@oathly/core', '@oathly/tokens'],
  serverExternalPackages: ['pg'],
};

export default nextConfig;
