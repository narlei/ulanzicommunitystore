import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Deliberately just the two React Hooks rules.
 *
 * They cover a bug class `tsc` is structurally blind to: a hook whose dependency array
 * misses a value it reads still type-checks perfectly, it just silently stops recomputing.
 * That shipped a dead filter once already.
 *
 * No style or `typescript-eslint` presets on purpose — pointing a default preset at a
 * 2900-line component would produce hundreds of findings nobody triages, and a lint run
 * everyone has learned to ignore is worth less than no lint at all. Start narrow, widen
 * only when a rule earns it.
 *
 * Severity is `warn`, and the CI step reports without failing: a signal, not a gate.
 */
export default [
  {
    ignores: [
      '.plugin-forks/**', // Vendored third-party plugin clones — not ours to lint.
      'plugin-starter/**',
      'dist/**',
      'node_modules/**',
      '.cache/**',
    ],
  },
  {
    files: ['apps/store-desktop/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
