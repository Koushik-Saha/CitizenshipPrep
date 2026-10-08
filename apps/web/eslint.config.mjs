import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    '.next-e2e/**',
    'e2e/results/**',
    'e2e/report/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Vendored third-party files (the KTX2 transcoder).
    'public/**',
  ]),
]);

export default eslintConfig;
