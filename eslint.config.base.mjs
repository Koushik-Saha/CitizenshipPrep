import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Shared by every package in packages/*. The apps layer their framework
// config (eslint-config-next, eslint-config-expo) on top of their own files.
export default defineConfig([
  globalIgnores(['dist/**', 'coverage/**', '.turbo/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
]);
