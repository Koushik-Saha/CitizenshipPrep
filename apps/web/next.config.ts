import { existsSync } from 'node:fs';
import path from 'node:path';

import type { NextConfig } from 'next';

// Secrets live in one .env.local at the repository root, shared with the
// content CLI and the database scripts. Next only reads apps/web/.env*, so
// load the root file here. On a host, the platform sets these instead.
const rootEnv = path.resolve(process.cwd(), '../../.env.local');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const expoWebOrigin = process.env.EXPO_WEB_ORIGIN ?? 'http://localhost:8081';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: [
    '@oathly/api',
    '@oathly/content',
    '@oathly/core',
    '@oathly/i18n',
    '@oathly/tokens',
  ],
  serverExternalPackages: ['pg'],
  // Development only: lets the Expo app, run in a browser with `expo start
  // --web`, call this API from its own origin. Phones are not browsers and
  // need no CORS; production serves none.
  async headers() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: expoWebOrigin },
          { key: 'Access-Control-Allow-Headers', value: 'authorization, content-type, accept' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
        ],
      },
    ];
  },
};

export default nextConfig;
