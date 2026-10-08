import { randomBytes } from 'node:crypto';

import { defineConfig, devices } from '@playwright/test';

// End-to-end checks: a real browser against a development server and a
// scratch database with made-up content (see e2e/README.md). Nothing here
// touches real questions, a real inbox, the AI, or a payment provider.

const port = Number(process.env.E2E_PORT ?? 3210);
const baseURL = `http://localhost:${port}`;

// One secret per run, shared with the tests through the environment: the
// development-only test sign-in is how they become a learner.
process.env.TEST_SIGN_IN_SECRET ??= randomBytes(32).toString('hex');
process.env.E2E_ADMIN_USERNAME ??= 'reviewer';
process.env.E2E_ADMIN_PASSWORD ??= randomBytes(12).toString('hex');

export default defineConfig({
  testDir: './e2e/tests',
  // Visits every page once first, so no test waits on the compiler.
  globalSetup: './e2e/global-setup.ts',
  outputDir: './e2e/results',
  // The development server compiles a page the first time it is asked for.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'e2e/report' }]]
    : 'list',
  use: {
    baseURL,
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next dev -p ${port}`,
    url: `${baseURL}/robots.txt`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(port),
      // Its own build directory: see distDir in next.config.ts.
      NEXT_DIST_DIR: '.next-e2e',
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ??
        'postgres://postgres:postgres@127.0.0.1:54329/oathly_e2e?sslmode=disable',
      TEST_SIGN_IN_SECRET: process.env.TEST_SIGN_IN_SECRET,
      ADMIN_USERNAME: process.env.E2E_ADMIN_USERNAME,
      ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
      // Sign-in is "set up", so its form is on the page to be checked, but
      // points nowhere: no test signs in for real.
      NEON_AUTH_BASE_URL: 'http://127.0.0.1:9/neon-auth',
      NEON_AUTH_COOKIE_SECRET: randomBytes(32).toString('hex'),
      // Never the real services, whatever .env.local holds.
      ANTHROPIC_API_KEY: '',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      MAILTRAP_TOKEN: '',
      SENTRY_DSN: '',
      NEXT_PUBLIC_SENTRY_DSN: '',
      POSTHOG_KEY: '',
      SITE_URL: baseURL,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
