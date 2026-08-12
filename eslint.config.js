import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `dev-dist` lo genera vite-plugin-pwa al levantar el servidor de desarrollo.
  globalIgnores(['dist', 'dev-dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // El proyecto no admite `any`: la capa de queries y los tipos del schema
      // tienen que cerrar de verdad, no taparse con un escape.
      '@typescript-eslint/no-explicit-any': 'error',
      // Los tipos se importan con `import type` porque `verbatimModuleSyntax`
      // no los borra solo.
      '@typescript-eslint/consistent-type-imports': 'error',
      // Un `_` adelante marca lo que se descarta a propósito, típicamente al
      // separar una prop del resto para no reenviarla al DOM.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
])
