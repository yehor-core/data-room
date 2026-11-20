import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import reactHooks from 'eslint-plugin-react-hooks';
import testingLibrary from 'eslint-plugin-testing-library';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const unusedVarsOptions = {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrors: 'all',
  ignoreRestSiblings: true,
};
const testFiles = ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'];

export default defineConfig([
  globalIgnores(['**/node_modules/', '**/build/', '**/dist/', '**/coverage/']),

  js.configs.recommended,
  {
    rules: {
      'no-console': 'error',
      'no-unused-vars': ['error', unusedVarsOptions],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', unusedVarsOptions],
    },
  },

  {
    files: ['**/*.{js,cjs}'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },

  {
    files: ['backend/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // The one place the backend may write to the console.
    files: ['backend/src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },

  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    languageOptions: { globals: globals.browser },
    rules: {
      // Only tells you that React Compiler will skip a component; this project doesn't use the compiler.
      'react-hooks/incompatible-library': 'off',
    },
  },
  {
    files: testFiles.map((glob) => `frontend/src/${glob}`),
    extends: [testingLibrary.configs['flat/react']],
  },

  {
    files: ['e2e/**/*.ts', 'frontend/e2e/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
  },
]);
