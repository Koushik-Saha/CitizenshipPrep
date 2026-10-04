// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'public/*'],
  },
  {
    // React Three Fiber's JSX elements (<mesh>, <sphereGeometry args={...}>)
    // take three.js properties, which the DOM-minded rule does not know.
    files: ['src/components/globe/**'],
    rules: { 'react/no-unknown-property': 'off' },
  },
]);
