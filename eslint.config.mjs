import globals from 'globals';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      '.local/**',
      '.vortex-static/**',
    ],
  },
  {
    files: [
      'api/**/*.js',
      'src/**/*.js',
      'server/**/*.js',
      'scripts/**/*.{js,cjs}',
      'tests/workflows/**/*.{js,cjs}',
      'server.js',
    ],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    rules: { 'no-debugger': 'error', 'no-undef': 'error' },
  },
  {
    files: ['web/js/**/*.js'],
    languageOptions: { globals: globals.browser, sourceType: 'module' },
    rules: { 'no-debugger': 'error', 'no-undef': 'error' },
  },
  {
    files: ['scripts/smoke-v2-storefront.cjs'],
    languageOptions: { globals: { document: 'readonly' } },
  },
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
    rules: { 'no-debugger': 'error', 'no-var': 'error' },
  },
];
