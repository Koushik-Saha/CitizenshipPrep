import { existsSync } from 'node:fs';
import path from 'node:path';

import type { NextConfig } from 'next';

// Secrets live in one .env.local at the repository root, shared with the
// content CLI and the database scripts. Next only reads apps/web/.env*, so
// load the root file here. On a host, the platform sets these instead.
const rootEnv = path.resolve(process.cwd(), '../../.env.local');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const expoWebOrigin = process.env.EXPO_WEB_ORIGIN ?? 'http://localhost:8081';
const isDev = process.env.NODE_ENV === 'development';

// What a page may load and where it may send, for every response.
//
// Scripts and styles may be inline: the public pages are built ahead of time,
// and the alternative (a nonce per request) would mean rendering every page
// on demand. Everything else is held to this site: no plugins, no framing by
// other sites, no <base> or form pointed elsewhere. WebAssembly is allowed for
// the globe's texture decoder; "blob:" for its worker and for recorded audio.
// See docs/security.md.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The sign-in service, error reporting and payments are called over HTTPS.
  `connect-src 'self' https:${isDev ? ' ws: http://localhost:*' : ''}`,
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The microphone is for answering aloud; nothing else is asked for.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=(self), payment=(), usb=(), browsing-topics=()',
  },
  // Browsers ignore this over plain HTTP, so it is harmless on a laptop.
  ...(isDev
    ? []
    : [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ]),
];

const nextConfig: NextConfig = {
  // The end-to-end tests run their own development server with their own
  // environment. It keeps its cache apart from `pnpm dev`'s: the two sharing
  // one corrupts it.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: [
    '@oathly/api',
    '@oathly/content',
    '@oathly/core',
    '@oathly/i18n',
    '@oathly/tokens',
  ],
  serverExternalPackages: ['pg'],
  // Nothing in a response says what it was built with.
  poweredByHeader: false,
  async headers() {
    const everywhere = { source: '/:path*', headers: securityHeaders };
    if (!isDev) return [everywhere];
    // Development only: lets the Expo app, run in a browser with `expo start
    // --web`, call this API from its own origin. Phones are not browsers and
    // need no CORS; production serves none.
    return [
      everywhere,
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

// Sentry's build step uploads source maps, so errors read as the code that
// was written. It needs an auth token; without one the build is left alone.
// (Error reporting itself only needs the DSN: see src/instrumentation.ts.)
async function withSourceMaps(config: NextConfig): Promise<NextConfig> {
  if (!process.env.SENTRY_AUTH_TOKEN) return config;
  const { withSentryConfig } = await import('@sentry/nextjs/config');
  return withSentryConfig(config, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
  });
}

export default withSourceMaps(nextConfig);
