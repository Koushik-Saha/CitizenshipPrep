import { defineConfig } from 'vitest/config';

// Coverage is measured with the database up (TEST_DATABASE_URL), since most
// of this package is queries: `pnpm --filter @oathly/api test:coverage`, as
// CI's database job runs it. Without the database the same tests run, the
// database ones are skipped, and nothing is held to a number.
//
// Left out of the count: React hooks (exercised by the browser tests), the
// generated database types, and the call to Claude itself, which no test may
// make.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/database.types.ts',
        'src/hooks.ts',
        'src/audio-hooks.ts',
        'src/server/ai/generator.ts',
      ],
      reporter: ['text-summary', 'json-summary'],
      thresholds: { lines: 95, statements: 94, functions: 95, branches: 88 },
    },
  },
});
